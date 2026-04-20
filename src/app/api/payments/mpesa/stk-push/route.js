import { randomUUID } from 'crypto'

import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { getMpesaConfig, initiateMpesaStkPush, normalizeKenyanPhone } from '@/libs/payments/mpesa'
import { enforceSameOriginMutation, isStoragePathOwnedByUser } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const MANAGEMENT_ROLES = new Set([USER_ROLES.ADMIN, USER_ROLES.LANDLORD, USER_ROLES.AGENT])

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

const toPositiveAmount = value => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.round(parsed)
}

const buildGatewayErrorDetails = ({
  ownerId,
  amount,
  phoneNumber,
  accountReference,
  description,
  invoiceId
}) => ({
  provider: 'mpesa',
  ownerId,
  amount,
  phoneNumber,
  accountReference,
  description,
  invoiceId,
  nextAction: 'payment_failed',
  paymentStatus: 'not_started'
})

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

  let body

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const amount = toPositiveAmount(body?.amount)

  if (!amount) {
    return API_RESPONSES.badRequest(request, 'amount must be a positive number.')
  }

  const phoneNumber = normalizeKenyanPhone(body?.phoneNumber)

  if (!phoneNumber) {
    return API_RESPONSES.badRequest(request, 'phoneNumber must be a valid Kenyan mobile number.')
  }

  let ownerId = String(body?.ownerId || '').trim()
  let tenantName = String(body?.tenantName || '').trim()

  if (MANAGEMENT_ROLES.has(role)) {
    ownerId = ownerId || user.id

    if (ownerId !== user.id && role !== USER_ROLES.ADMIN) {
      return API_RESPONSES.forbidden(request, 'Only admins can initiate payment for another owner.')
    }
  } else {
    ownerId = ownerId || ''

    if (!ownerId) {
      return API_RESPONSES.badRequest(request, 'ownerId is required for tenant payment.')
    }

    const tenantResult = await safeQuery(
      supabase.from('tenants').select('tenant_name,owner_id').eq('auth_user_id', user.id).eq('owner_id', ownerId).maybeSingle()
    )

    if (tenantResult.error || !tenantResult.data) {
      return API_RESPONSES.forbidden(request, 'Tenant is not mapped to the specified owner. Update tenancy mapping first.')
    }

    tenantName = tenantName || tenantResult.data.tenant_name || user.email?.split('@')[0] || 'Tenant'
  }

  const accountReference = String(body?.accountReference || `RENT-${ownerId.slice(0, 8)}`).trim()
  const description = String(body?.description || 'Rent payment').trim()
  const invoiceId = String(body?.invoiceId || '').trim() || null
  const proofPath = String(body?.proofPath || '').trim() || null
  const payerName = String(body?.payerName || '').trim() || null
  const payerPhone = String(body?.payerPhone || '').trim() || null

  if (proofPath && proofPath.includes('..')) {
    return API_RESPONSES.badRequest(request, 'Invalid proof path.')
  }

  if (proofPath && role !== USER_ROLES.ADMIN && !isStoragePathOwnedByUser(proofPath, user.id)) {
    return API_RESPONSES.badRequest(request, 'Proof path must belong to the signed-in account.')
  }

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'payments-mpesa-stk',
    identifier: `${user.id}:${ownerId}`,
    limit: 8,
    windowMs: 5 * 60_000,
    message: 'Too many payment attempts. Please wait before initiating another STK push.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  let config

  try {
    config = getMpesaConfig({ required: true })
  } catch (error) {
    return API_RESPONSES.unavailable(request, error?.message || 'M-Pesa is not configured.')
  }

  let mpesaResponse

  try {
    mpesaResponse = await initiateMpesaStkPush({
      config,
      phoneNumber,
      amount,
      accountReference,
      description
    })
  } catch (error) {
    return API_RESPONSES.badGateway(
      request,
      error?.message || 'Failed to initiate M-Pesa STK push.',
      buildGatewayErrorDetails({
        ownerId,
        amount,
        phoneNumber,
        accountReference,
        description,
        invoiceId
      })
    )
  }

  const adminSupabase = createAdminClient()

  if (!adminSupabase && ownerId !== user.id) {
    return API_RESPONSES.unavailable(request, 'SUPABASE_SERVICE_ROLE_KEY is required to write cross-owner payment records.')
  }

  const writer = adminSupabase || supabase

  const providerResponse = {
    MerchantRequestID: mpesaResponse.MerchantRequestID || null,
    CheckoutRequestID: mpesaResponse.CheckoutRequestID || null,
    ResponseCode: mpesaResponse.ResponseCode || null,
    ResponseDescription: mpesaResponse.ResponseDescription || null,
    CustomerMessage: mpesaResponse.CustomerMessage || null
  }

  const paymentPayload = {
    owner_id: ownerId,
    tenant_name: tenantName || user.email?.split('@')[0] || 'Tenant',
    channel: 'M-Pesa STK',
    amount,
    status: 'pending',
    invoice_id: invoiceId,
    transaction_ref: mpesaResponse.MerchantRequestID || null,
    channel_reference: mpesaResponse.CheckoutRequestID || null,
    metadata: {
      provider: 'mpesa',
      account_reference: accountReference,
      initiated_by: user.id,
      initiated_role: role,
      request_description: description,
      payer_name: payerName,
      payer_phone_masked: maskPhone(payerPhone),
      proof_path: proofPath,
      provider_response: providerResponse
    }
  }

  const paymentResult = await safeQuery(
    writer
      .from('payments')
      .insert(paymentPayload)
      .select('id, receipt_no, status, amount, channel_reference, owner_id')
      .single()
  )

  if (paymentResult.error) {
    return API_RESPONSES.badRequest(request, paymentResult.error.message)
  }

  const paymentRow = paymentResult.data

  if (paymentRow?.id) {
    await safeQuery(
      writer.from('payment_provider_events').insert({
        owner_id: paymentRow.owner_id,
        payment_id: paymentRow.id,
        provider: 'mpesa',
        event_type: 'stk_initiated',
        checkout_request_id: mpesaResponse.CheckoutRequestID || null,
        merchant_request_id: mpesaResponse.MerchantRequestID || null,
        status: paymentRow.status,
        payload: {
          phoneNumberMasked: maskPhone(phoneNumber),
          amount,
          accountReference,
          description,
          response: providerResponse
        }
      })
    )
  }

  if (proofPath) {
    const today = new Date().toISOString().slice(0, 10)

    const docRows = [
      {
        owner_id: paymentRow.owner_id,
        doc_id: `DOC-${Date.now()}-${randomUUID().slice(0, 8)}`,
        type: 'Tenant Payment Proof',
        owner_name: paymentPayload.tenant_name,
        uploaded: today,
        status: 'pending review',
        file_path: proofPath
      }
    ]

    if (user.id && user.id !== paymentRow.owner_id) {
      docRows.push({
        owner_id: user.id,
        doc_id: `DOC-${Date.now()}-${randomUUID().slice(0, 8)}`,
        type: 'Payment Proof Copy',
        owner_name: paymentPayload.tenant_name,
        uploaded: today,
        status: 'active',
        file_path: proofPath
      })
    }

    await safeQuery(writer.from('documents').insert(docRows))
  }

  return API_RESPONSES.accepted(request, {
    paymentId: paymentRow.id,
    receiptNo: paymentRow.receipt_no,
    amount: paymentRow.amount,
    ownerId: paymentRow.owner_id,
    status: paymentRow.status,
    paymentStatus: 'pending_confirmation',
    nextAction: 'enter_pin',
    checkoutRequestId: mpesaResponse.CheckoutRequestID || null,
    customerMessage: mpesaResponse.CustomerMessage || 'STK push initiated.'
  })
}
