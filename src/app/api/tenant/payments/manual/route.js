import { randomUUID } from 'crypto'

import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation, isStoragePathOwnedByUser } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const SUPPORTED_METHODS = new Map([
  ['bank_transfer', 'Bank Transfer'],
  ['bank', 'Bank Transfer'],
  ['card', 'Card Payment'],
  ['cash', 'Cash Deposit'],
  ['other', 'Other']
])

const maskPhone = value => {
  const normalized = String(value || '').trim()

  if (!normalized) {
    return null
  }

  if (normalized.length <= 4) {
    return '*'.repeat(normalized.length)
  }

  return `${'*'.repeat(normalized.length - 4)}${normalized.slice(-4)}`
}

const isColumnMissingError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const normalizeMethod = value => String(value || '').trim().toLowerCase()

const toPositiveAmount = value => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.round(parsed * 100) / 100
}

const makeReceiptNo = () => {
  const date = new Date()
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 900 + 100)

  return `RCP-${y}${m}${d}-${rand}`
}

const makeDocId = () => `DOC-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`

const runQuery = safeQuery

const loadTenantScope = async (supabase, userId) => {
  const result = await runQuery(supabase.from('tenants').select('id,owner_id,tenant_name').eq('auth_user_id', userId).limit(25))

  if (result.error) {
    return {
      rows: [],
      error: result.error
    }
  }

  return {
    rows: result.data || [],
    error: null
  }
}

const findInvoiceForTenant = async ({ supabase, invoiceId, ownerId, tenantIds, tenantNames, ownerIds }) => {
  if (!invoiceId) {
    return {
      row: null,
      error: new Error('invoiceId is required.')
    }
  }

  if (tenantIds.length) {
    let byTenantIdQuery = supabase
      .from('invoices')
      .select('id,owner_id,invoice_no,tenant_name,due_amount,status,period')
      .eq('id', invoiceId)
      .in('tenant_id', tenantIds)
      .maybeSingle()

    if (ownerId) {
      byTenantIdQuery = byTenantIdQuery.eq('owner_id', ownerId)
    } else if (ownerIds.length) {
      byTenantIdQuery = byTenantIdQuery.in('owner_id', ownerIds)
    }

    const byTenantId = await runQuery(byTenantIdQuery)

    if (!byTenantId.error && byTenantId.data) {
      return {
        row: byTenantId.data,
        error: null
      }
    }

    if (byTenantId.error && !isColumnMissingError(byTenantId.error)) {
      return {
        row: null,
        error: byTenantId.error
      }
    }
  }

  if (!tenantNames.length) {
    return {
      row: null,
      error: new Error('Tenant mapping not found for this invoice.')
    }
  }

  let byTenantNameQuery = supabase
    .from('invoices')
    .select('id,owner_id,invoice_no,tenant_name,due_amount,status,period')
    .eq('id', invoiceId)
    .in('tenant_name', tenantNames)
    .maybeSingle()

  if (ownerId) {
    byTenantNameQuery = byTenantNameQuery.eq('owner_id', ownerId)
  } else if (ownerIds.length) {
    byTenantNameQuery = byTenantNameQuery.in('owner_id', ownerIds)
  }

  const byTenantName = await runQuery(byTenantNameQuery)

  if (byTenantName.error) {
    return {
      row: null,
      error: byTenantName.error
    }
  }

  if (!byTenantName.data) {
    return {
      row: null,
      error: new Error('Invoice not found for this tenant account.')
    }
  }

  return {
    row: byTenantName.data,
    error: null
  }
}

const insertPaymentWithFallback = async ({ writer, payload }) => {
  const removableOptionalFields = ['metadata', 'invoice_id', 'channel_reference', 'transaction_ref']
  const workingPayload = { ...payload }
  let lastError = null

  for (let step = 0; step <= removableOptionalFields.length; step += 1) {
    const attempt = await runQuery(
      writer
        .from('payments')
        .insert(workingPayload)
        .select('id,receipt_no,status,amount,owner_id,channel,created_at')
        .maybeSingle()
    )

    if (!attempt.error && attempt.data) {
      return {
        row: attempt.data,
        error: null
      }
    }

    if (!attempt.error) {
      return {
        row: null,
        error: new Error('Payment record could not be created.')
      }
    }

    if (!isColumnMissingError(attempt.error)) {
      return {
        row: null,
        error: attempt.error
      }
    }

    lastError = attempt.error
    const removableField = removableOptionalFields[step]

    if (removableField) {
      delete workingPayload[removableField]
    }
  }

  return {
    row: null,
    error: lastError || new Error('Unable to create payment record.')
  }
}

export async function POST(request) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return API_RESPONSES.unavailable(request, 'Supabase is not configured.')
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return API_RESPONSES.unauthorized(request)
  }

  const role = await resolveUserRole(supabase, user)

  if (role !== USER_ROLES.TENANT) {
    return API_RESPONSES.forbidden(request, 'Only tenants can submit this payment flow.')
  }

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'tenant-manual-payment',
    identifier: user.id,
    limit: 15,
    windowMs: 10 * 60_000,
    message: 'Too many payment submissions. Please wait and try again.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const invoiceId = String(body?.invoiceId || '').trim()
  const ownerIdInput = String(body?.ownerId || '').trim() || null
  const method = normalizeMethod(body?.method)
  const amount = toPositiveAmount(body?.amount)
  const payerName = String(body?.payerName || '').trim() || user.email?.split('@')[0] || 'Tenant'
  const payerPhone = String(body?.payerPhone || '').trim() || null
  const accountReference = String(body?.accountReference || '').trim() || null
  const notes = String(body?.notes || '').trim() || null
  const proofPath = String(body?.proofPath || '').trim() || null

  if (!invoiceId) {
    return API_RESPONSES.badRequest(request, 'invoiceId is required.')
  }

  if (!SUPPORTED_METHODS.has(method)) {
    return API_RESPONSES.badRequest(
      request,
      'Unsupported payment method for this endpoint. Use M-Pesa via the STK flow, or choose bank/card/cash/other.'
    )
  }

  if (!amount) {
    return API_RESPONSES.badRequest(request, 'amount must be a positive number.')
  }

  if (proofPath && proofPath.includes('..')) {
    return API_RESPONSES.badRequest(request, 'Invalid proof path.')
  }

  if (proofPath && !isStoragePathOwnedByUser(proofPath, user.id)) {
    return API_RESPONSES.badRequest(request, 'Proof path must belong to your account.')
  }

  const tenantScope = await loadTenantScope(supabase, user.id)

  if (tenantScope.error) {
    return API_RESPONSES.badRequest(request, tenantScope.error.message || 'Unable to load tenant mapping.')
  }

  if (!tenantScope.rows.length) {
    return API_RESPONSES.forbidden(request, 'Tenant profile mapping is missing. Ask your landlord to map your account first.')
  }

  const tenantIds = tenantScope.rows.map(row => row.id).filter(Boolean)
  const tenantNames = [...new Set(tenantScope.rows.map(row => String(row.tenant_name || '').trim()).filter(Boolean))]
  const ownerIds = [...new Set(tenantScope.rows.map(row => row.owner_id).filter(Boolean))]

  const invoiceLookup = await findInvoiceForTenant({
    supabase,
    invoiceId,
    ownerId: ownerIdInput,
    tenantIds,
    tenantNames,
    ownerIds
  })

  if (invoiceLookup.error || !invoiceLookup.row) {
    return API_RESPONSES.forbidden(request, invoiceLookup.error?.message || 'Invoice lookup failed.')
  }

  const invoice = invoiceLookup.row
  const routedOwnerId = String(invoice.owner_id || '').trim()

  if (!routedOwnerId || !ownerIds.includes(routedOwnerId)) {
    return API_RESPONSES.forbidden(request, 'This invoice is not mapped to your tenant profile.')
  }

  const tenantName = tenantScope.rows.find(row => row.owner_id === routedOwnerId)?.tenant_name || invoice.tenant_name || payerName
  const channelLabel = SUPPORTED_METHODS.get(method) || 'Manual Payment'
  const receiptNo = makeReceiptNo()
  const adminSupabase = createAdminClient()
  const writer = adminSupabase || supabase

  const paymentPayload = {
    owner_id: routedOwnerId,
    receipt_no: receiptNo,
    tenant_name: tenantName,
    channel: channelLabel,
    amount,
    status: 'pending',
    invoice_id: invoice.id,
    channel_reference: accountReference,
    transaction_ref: null,
    metadata: {
      provider: 'manual',
      method,
      invoice_id: invoice.id,
      invoice_no: invoice.invoice_no || null,
      initiated_by: user.id,
      initiated_role: role,
      payer_name: payerName,
      payer_phone_masked: maskPhone(payerPhone),
      account_reference: accountReference,
      notes,
      proof_path: proofPath
    }
  }

  const insertedPayment = await insertPaymentWithFallback({
    writer,
    payload: paymentPayload
  })

  if (insertedPayment.error || !insertedPayment.row) {
    return API_RESPONSES.badRequest(request, insertedPayment.error?.message || 'Unable to record payment.')
  }

  let warning = null

  if (proofPath) {
    const today = new Date().toISOString().slice(0, 10)

    const proofRows = [
      {
        owner_id: routedOwnerId,
        doc_id: makeDocId(),
        type: 'Tenant Payment Proof',
        owner_name: tenantName,
        uploaded: today,
        status: 'pending review',
        file_path: proofPath
      },
      {
        owner_id: user.id,
        doc_id: makeDocId(),
        type: 'Payment Proof Copy',
        owner_name: tenantName,
        uploaded: today,
        status: 'active',
        file_path: proofPath
      }
    ]

    const documentInsert = await runQuery(writer.from('documents').insert(proofRows).select('id'))

    if (documentInsert.error) {
      warning = 'Payment recorded, but proof attachment record could not be created for landlord review.'
    }
  }

  return API_RESPONSES.ok(request, {
    paymentId: insertedPayment.row.id,
    receiptNo: insertedPayment.row.receipt_no,
    status: insertedPayment.row.status,
    routedOwnerId,
    routedInvoiceId: invoice.id,
    message: warning || 'Payment has been submitted and routed to your landlord for verification.',
    warning
  })
}
