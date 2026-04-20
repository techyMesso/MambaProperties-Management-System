import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { safeQuery } from '@/libs/api/safeQuery'
import { getTenantSubscriptionPricing } from '@/libs/pricing/subscriptionPlans'

const isColumnMissingError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const runQuery = query => safeQuery(query, { fallbackData: [] })

const normalizeStatus = value => String(value || '').trim().toLowerCase()

const toAmount = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

const dedupeBy = (rows, getKey) => {
  const seen = new Set()

  return (rows || []).filter(row => {
    const key = getKey(row)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)

    return true
  })
}

const tenantKey = (ownerId, tenantName) => `${ownerId || ''}::${String(tenantName || '').trim().toLowerCase()}`

const createPaymentsBaseQuery = (supabase, includeInvoiceId, includeMetadata) => {
  const fields = ['id', 'owner_id', 'tenant_name', 'channel', 'amount', 'status', 'receipt_no', 'created_at']

  if (includeInvoiceId) {
    fields.push('invoice_id')
  }

  if (includeMetadata) {
    fields.push('metadata')
  }

  return supabase.from('payments').select(fields.join(',')).order('created_at', { ascending: false }).limit(500)
}

const queryPaymentsWithVariants = async ({ supabase, applyFilters }) => {
  const variants = [
    { includeInvoiceId: true, includeMetadata: true },
    { includeInvoiceId: true, includeMetadata: false },
    { includeInvoiceId: false, includeMetadata: false }
  ]

  let lastError = null

  for (const variant of variants) {
    const query = applyFilters(createPaymentsBaseQuery(supabase, variant.includeInvoiceId, variant.includeMetadata), variant)
    const result = await runQuery(query)

    if (!result.error) {
      return {
        ...result,
        variant
      }
    }

    if (!isColumnMissingError(result.error)) {
      return {
        ...result,
        variant
      }
    }

    lastError = result.error
  }

  return {
    data: [],
    error: lastError,
    variant: { includeInvoiceId: false, includeMetadata: false }
  }
}

const loadInvoicesForScope = async ({ supabase, tenantIds, tenantNames, ownerIds }) => {
  const collected = []
  const errors = []
  let allowNameFallback = !tenantIds.length && tenantNames.length > 0

  if (tenantIds.length) {
    let query = supabase
      .from('invoices')
      .select('id,owner_id,invoice_no,tenant_name,period,due_amount,status,created_at')
      .in('tenant_id', tenantIds)
      .order('created_at', { ascending: false })
      .limit(200)

    if (ownerIds.length) {
      query = query.in('owner_id', ownerIds)
    }

    const byTenantId = await runQuery(query)

    if (byTenantId.error) {
      if (isColumnMissingError(byTenantId.error)) {
        allowNameFallback = true
      } else {
        errors.push(byTenantId.error)
      }
    } else {
      collected.push(...byTenantId.data)
    }
  }

  if (allowNameFallback && tenantNames.length) {
    let query = supabase
      .from('invoices')
      .select('id,owner_id,invoice_no,tenant_name,period,due_amount,status,created_at')
      .in('tenant_name', tenantNames)
      .order('created_at', { ascending: false })
      .limit(200)

    if (ownerIds.length) {
      query = query.in('owner_id', ownerIds)
    }

    const byTenantName = await runQuery(query)

    if (byTenantName.error) {
      errors.push(byTenantName.error)
    } else {
      collected.push(...byTenantName.data)
    }
  }

  return {
    rows: dedupeBy(collected, row => String(row?.id || `${row?.owner_id || ''}-${row?.invoice_no || ''}`)),
    error: errors[0] || null
  }
}

const loadPaymentsForScope = async ({ supabase, invoiceIds, ownerIds, tenantNames }) => {
  const collected = []
  const errors = []
  let allowTenantNameFallback = !invoiceIds.length && tenantNames.length > 0

  if (invoiceIds.length) {
    const byInvoiceResult = await queryPaymentsWithVariants({
      supabase,
      applyFilters: (query, variant) => {
        let next = query

        if (variant.includeInvoiceId) {
          next = next.in('invoice_id', invoiceIds)
        } else {
          allowTenantNameFallback = true
          next = next.limit(0)
        }

        if (ownerIds.length) {
          next = next.in('owner_id', ownerIds)
        }

        return next
      }
    })

    if (byInvoiceResult.error) {
      if (isColumnMissingError(byInvoiceResult.error)) {
        allowTenantNameFallback = true
      } else {
        errors.push(byInvoiceResult.error)
      }
    } else {
      collected.push(...byInvoiceResult.data)

      if (!byInvoiceResult.variant.includeInvoiceId) {
        allowTenantNameFallback = true
      }
    }
  }

  if (allowTenantNameFallback && tenantNames.length) {
    const byTenantName = await queryPaymentsWithVariants({
      supabase,
      applyFilters: query => {
        let next = query.in('tenant_name', tenantNames)

        if (ownerIds.length) {
          next = next.in('owner_id', ownerIds)
        }

        return next
      }
    })

    if (byTenantName.error) {
      errors.push(byTenantName.error)
    } else {
      collected.push(...byTenantName.data)
    }
  }

  return {
    rows: dedupeBy(collected, row => String(row?.id || `${row?.owner_id || ''}-${row?.receipt_no || ''}`)),
    error: errors[0] || null
  }
}

const asMetadata = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value
}

const hasActiveTenantAccess = subscription => {
  const status = normalizeStatus(subscription?.status)
  const paymentStatus = normalizeStatus(subscription?.payment_status)
  const expiresAt = subscription?.expires_at ? new Date(subscription.expires_at) : null
  const notExpired = !expiresAt || expiresAt > new Date()

  return ['active', 'trial'].includes(status) && paymentStatus === 'paid' && notExpired
}

const loadTenantSubscriptionSnapshot = async ({ supabase, userId }) => {
  const pricing = await getTenantSubscriptionPricing(supabase, 'house_search')
  const defaultAmountDue = pricing.amount

  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select('id,subscription_type,status,payment_status,amount_due,currency,expires_at,created_at')
    .eq('user_id', userId)
    .eq('subscription_type', 'house_search')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return {
      subscription: {
        required: true,
        hasAccess: false,
        status: 'unknown',
        paymentStatus: 'unknown',
        amountDue: 0,
        currency: 'KES',
        expiresAt: null
      },
      error
    }
  }

  if (!data?.id) {
    return {
      subscription: {
        required: true,
        hasAccess: false,
        status: 'none',
        paymentStatus: 'unpaid',
        amountDue: defaultAmountDue,
        currency: pricing.currency || 'KES',
        expiresAt: null
      },
      error: null
    }
  }

  return {
    subscription: {
      id: data.id,
      required: true,
      hasAccess: hasActiveTenantAccess(data),
      status: normalizeStatus(data.status) || 'pending',
      paymentStatus: normalizeStatus(data.payment_status) || 'unpaid',
      amountDue: toAmount(data.amount_due),
      currency: String(data.currency || 'KES').trim() || 'KES',
      expiresAt: data.expires_at || null
    },
    error: null
  }
}

export async function GET(request) {
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
    return API_RESPONSES.forbidden(request, 'Only tenant accounts can access this payment context.')
  }

  const [tenantSubscriptionSnapshot, profileResult] = await Promise.all([
    loadTenantSubscriptionSnapshot({
      supabase,
      userId: user.id
    }),
    runQuery(supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle())
  ])

  const profilePhone = String(profileResult?.data?.phone || '').trim()

  const tenantProfiles = await runQuery(
    supabase.from('tenants').select('id,owner_id,tenant_name,unit_code').eq('auth_user_id', user.id).limit(25)
  )

  if (tenantProfiles.error) {
    return API_RESPONSES.badRequest(request, tenantProfiles.error.message || 'Unable to load tenant profile.')
  }

  const tenantRows = tenantProfiles.data
  const tenantIds = tenantRows.map(row => row.id).filter(Boolean)
  const ownerIds = [...new Set(tenantRows.map(row => row.owner_id).filter(Boolean))]
  const tenantNames = [...new Set(tenantRows.map(row => String(row.tenant_name || '').trim()).filter(Boolean))]

  if (!tenantRows.length) {
    return API_RESPONSES.ok(
      request,
      {
        tenantName: user.email?.split('@')[0] || 'Tenant',
        invoices: [],
        recentPayments: [],
        landlords: [],
        subscription: tenantSubscriptionSnapshot.subscription,
        profilePhone,
        dataSource: 'live'
      },
      { headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' } }
    )
  }

  const [invoiceResult, paymentResult] = await Promise.all([
    loadInvoicesForScope({
      supabase,
      tenantIds,
      tenantNames,
      ownerIds
    }),
    loadPaymentsForScope({
      supabase,
      invoiceIds: [],
      ownerIds,
      tenantNames
    })
  ])

  if (invoiceResult.error) {
    return API_RESPONSES.badRequest(request, invoiceResult.error.message || 'Unable to load invoices.')
  }

  let paymentRows = paymentResult.rows

  if (paymentResult.error && !invoiceResult.rows.length) {
    return API_RESPONSES.badRequest(request, paymentResult.error.message || 'Unable to load payments.')
  }

  const invoiceIds = invoiceResult.rows.map(row => row.id).filter(Boolean)

  if (invoiceIds.length) {
    const byInvoiceResult = await loadPaymentsForScope({
      supabase,
      invoiceIds,
      ownerIds,
      tenantNames
    })

    if (!byInvoiceResult.error) {
      paymentRows = dedupeBy([...paymentRows, ...byInvoiceResult.rows], row => String(row?.id || ''))
    }
  }

  const landlordById = new Map()
  const adminSupabase = createAdminClient()

  if (adminSupabase && ownerIds.length) {
    const landlordResult = await runQuery(adminSupabase.from('profiles').select('id,full_name,phone').in('id', ownerIds))

    landlordResult.data.forEach(row => {
      landlordById.set(row.id, {
        ownerId: row.id,
        name: String(row.full_name || '').trim() || `Landlord ${String(row.id || '').slice(0, 8)}`,
        phone: String(row.phone || '').trim() || null
      })
    })
  }

  ownerIds.forEach(ownerId => {
    if (!landlordById.has(ownerId)) {
      landlordById.set(ownerId, {
        ownerId,
        name: `Landlord ${String(ownerId).slice(0, 8)}`,
        phone: null
      })
    }
  })

  const paidByInvoice = new Map()
  const paidByTenantAndOwner = new Map()

  paymentRows.forEach(row => {
    const status = normalizeStatus(row?.status)

    if (!['paid', 'partial'].includes(status)) {
      return
    }

    const amount = toAmount(row?.amount)

    if (amount <= 0) {
      return
    }

    if (row?.invoice_id) {
      paidByInvoice.set(row.invoice_id, (paidByInvoice.get(row.invoice_id) || 0) + amount)
    }

    const key = tenantKey(row?.owner_id, row?.tenant_name)

    if (key) {
      paidByTenantAndOwner.set(key, (paidByTenantAndOwner.get(key) || 0) + amount)
    }
  })

  const invoices = invoiceResult.rows.map(row => {
    const dueAmount = toAmount(row?.due_amount)
    const fallbackTenantKey = tenantKey(row?.owner_id, row?.tenant_name)
    const paidAmount = row?.id ? paidByInvoice.get(row.id) || 0 : paidByTenantAndOwner.get(fallbackTenantKey) || 0
    const outstandingAmount = Math.max(0, dueAmount - paidAmount)
    const metadata = asMetadata(row?.metadata)
    const invoiceFilePath = String(metadata?.invoice_file_path || '').trim() || null

    return {
      id: row.id,
      ownerId: row.owner_id,
      landlordName: landlordById.get(row.owner_id)?.name || 'Landlord',
      invoiceNo: row.invoice_no || 'Invoice',
      tenantName: row.tenant_name || tenantRows[0]?.tenant_name || 'Tenant',
      period: row.period || 'Current Period',
      dueAmount,
      paidAmount,
      outstandingAmount,
      status: String(row.status || '').trim() || 'pending',
      createdAt: row.created_at || null,
      invoiceFilePath
    }
  })

  const recentPayments = paymentRows.slice(0, 20).map(row => {
    const metadata = asMetadata(row?.metadata)

    return {
      id: row.id || null,
      ownerId: row.owner_id || null,
      landlordName: landlordById.get(row.owner_id)?.name || 'Landlord',
      receiptNo: row.receipt_no || 'Pending',
      tenantName: row.tenant_name || tenantRows[0]?.tenant_name || 'Tenant',
      channel: row.channel || 'Unknown',
      amount: toAmount(row.amount),
      status: row.status || 'pending',
      createdAt: row.created_at || null,
      accountReference: String(metadata?.account_reference || '').trim() || null,
      proofPath: String(metadata?.proof_path || '').trim() || null
    }
  })

  return API_RESPONSES.ok(
    request,
    {
      tenantName: tenantRows[0]?.tenant_name || user.email?.split('@')[0] || 'Tenant',
      invoices,
      recentPayments,
      landlords: Array.from(landlordById.values()),
      subscription: tenantSubscriptionSnapshot.subscription,
      profilePhone,
      dataSource: 'live'
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    }
  )
}
