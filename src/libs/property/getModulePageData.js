import 'server-only'

import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { evaluateModuleAccessGate } from '@/libs/access/moduleGates'
import { safeQuery } from '@/libs/api/safeQuery'

import { canCreateModuleForRole, getModuleCreateFields, getModuleDefinition, getModuleFallback } from './modules'

const withSource = (data, source) => ({
  ...data,
  dataSource: source
})

const normalizeStatus = value => String(value || '').trim().toLowerCase()

const toAmount = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

const sumRows = (rows, key, predicate = () => true) =>
  (rows || []).reduce((total, row) => (predicate(row) ? total + toAmount(row?.[key]) : total), 0)

const countRows = (rows, predicate = () => true) => (rows || []).reduce((count, row) => (predicate(row) ? count + 1 : count), 0)

const formatKES = value => `KES ${Math.max(0, Math.round(toAmount(value))).toLocaleString('en-KE')}`

const zeroLike = value => {
  const normalized = String(value || '').toLowerCase()

  if (normalized.includes('kes') || normalized.includes('ksh')) {
    return formatKES(0)
  }

  if (normalized.includes('%')) {
    return '0%'
  }

  if (normalized.includes('gb')) {
    return '0 GB'
  }

  return '0'
}

const resolveScopeHint = role => {
  if (role === USER_ROLES.ADMIN) {
    return 'Live records across the platform'
  }

  if (role === USER_ROLES.TENANT) {
    return 'Visible to your account'
  }

  return 'Live records scoped to your account'
}

const withLiveStats = (fallback, moduleKey, rows, { scopeHint } = {}) => {
  const resolvedHint = scopeHint || 'Live records scoped to your account'

  const clonedStats = fallback.stats.map(item => ({
    ...item,
    value: zeroLike(item.value),
    hint: resolvedHint
  }))

  if (clonedStats[0]) {
    clonedStats[0].value = String(rows.length)
    clonedStats[0].hint = 'Live records in database'
  }

  if (moduleKey === 'payments' || moduleKey === 'paymentsMonitoring') {
    const paidAmount = sumRows(rows, 'amount', row => ['paid', 'partial'].includes(normalizeStatus(row?.status)))
    const pendingAmount = sumRows(rows, 'amount', row => ['pending', 'partial'].includes(normalizeStatus(row?.status)))
    const arrearsAmount = sumRows(rows, 'amount', row => ['arrears', 'overdue'].includes(normalizeStatus(row?.status)))

    if (clonedStats[0]) {
      clonedStats[0].value = formatKES(paidAmount)
      clonedStats[0].hint = 'Paid and partial transactions'
    }

    if (clonedStats[1]) {
      clonedStats[1].value = formatKES(pendingAmount)
      clonedStats[1].hint = 'Pending or partial balances'
    }

    if (clonedStats[2]) {
      clonedStats[2].value = formatKES(arrearsAmount)
      clonedStats[2].hint = 'Arrears and overdue balances'
    }

    if (clonedStats[3]) {
      clonedStats[3].value = String(rows.length)
      clonedStats[3].hint = 'Payment records visible to you'
    }
  }

  if (moduleKey === 'landlordLeads') {
    const qualified = countRows(rows, row => ['qualified', 'requested'].includes(normalizeStatus(row?.stage)))
    const converted = countRows(rows, row => ['converted', 'active'].includes(normalizeStatus(row?.stage)))

    if (clonedStats[0]) {
      clonedStats[0].value = String(rows.length)
      clonedStats[0].hint = 'Recent landlord prospect signups'
    }

    if (clonedStats[1]) {
      clonedStats[1].value = String(qualified)
      clonedStats[1].hint = 'Ready for onboarding call'
    }

    if (clonedStats[2]) {
      clonedStats[2].value = String(converted)
      clonedStats[2].hint = 'Lead to active landlord profile'
    }

    if (clonedStats[3]) {
      clonedStats[3].value = String(Math.max(0, rows.length - converted))
      clonedStats[3].hint = 'Leads waiting follow-up'
    }
  }

  if (moduleKey === 'onboardingPipeline') {
    const setupPending = countRows(rows, row => normalizeStatus(row?.stage) === 'setup pending')
    const trial = countRows(rows, row => normalizeStatus(row?.stage) === 'trial')
    const activated = countRows(rows, row => normalizeStatus(row?.stage) === 'activated')
    const blocked = countRows(rows, row => normalizeStatus(row?.stage) === 'blocked')

    if (clonedStats[0]) {
      clonedStats[0].value = String(setupPending)
      clonedStats[0].hint = 'Need KYC/setup completion'
    }

    if (clonedStats[1]) {
      clonedStats[1].value = String(trial)
      clonedStats[1].hint = 'Currently evaluating platform'
    }

    if (clonedStats[2]) {
      clonedStats[2].value = String(activated)
      clonedStats[2].hint = 'Converted to active subscription'
    }

    if (clonedStats[3]) {
      clonedStats[3].value = String(blocked)
      clonedStats[3].hint = 'Need manual intervention'
    }
  }

  if (moduleKey === 'invoices') {
    const paidInvoices = countRows(rows, row => normalizeStatus(row?.status) === 'paid')
    const overdueInvoices = countRows(rows, row => ['overdue', 'arrears'].includes(normalizeStatus(row?.status)))
    const paymentActivity = countRows(rows, row => ['paid', 'partial'].includes(normalizeStatus(row?.status)))

    if (clonedStats[0]) {
      clonedStats[0].value = String(rows.length)
      clonedStats[0].hint = 'Invoices in your account'
    }

    if (clonedStats[1]) {
      clonedStats[1].value = String(paidInvoices)
      clonedStats[1].hint = 'Marked paid'
    }

    if (clonedStats[2]) {
      clonedStats[2].value = String(overdueInvoices)
      clonedStats[2].hint = 'Overdue follow-up'
    }

    if (clonedStats[3]) {
      clonedStats[3].value = String(paymentActivity)
      clonedStats[3].hint = 'Invoices with payment activity'
    }
  }

  if (moduleKey === 'marketplace') {
    const viewingReady = countRows(rows, row => ['scheduled', 'open'].includes(normalizeStatus(row?.stage)))
    const bookingPending = countRows(rows, row => ['pending', 'booked'].includes(normalizeStatus(row?.stage)))

    if (clonedStats[1]) {
      clonedStats[1].value = String(viewingReady)
      clonedStats[1].hint = 'Listings ready for viewing'
    }

    if (clonedStats[2]) {
      clonedStats[2].value = String(bookingPending)
      clonedStats[2].hint = 'Listings in booking stage'
    }

    if (clonedStats[3]) {
      clonedStats[3].value = formatKES(0)
      clonedStats[3].hint = 'Booking fee totals are account-scoped'
    }
  }

  return clonedStats
}

const isColumnMissingError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const resolveSchemaWarning = error => {
  const message = String(error?.message || '').toLowerCase()

  if (message.includes('does not exist') && (message.includes('column') || message.includes('relation') || message.includes('table'))) {
    return 'Module schema is not initialized. Run the latest migration.'
  }

  return ''
}

const runQuery = query => safeQuery(query, { fallbackData: [] })

const createBaseQuery = (supabase, definition) => supabase.from(definition.table).select(definition.select).order(definition.orderBy, { ascending: false })

const dedupeRows = rows => {
  const seen = new Set()

  return (rows || []).filter(row => {
    const key = JSON.stringify(row)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)

    return true
  })
}

const getTenantScope = async (supabase, userId) => {
  const { data, error } = await runQuery(supabase.from('tenants').select('id,owner_id,tenant_name,unit_code').eq('auth_user_id', userId))

  return {
    error,
    tenantIds: data.map(row => row.id).filter(Boolean),
    tenantNames: data.map(row => row.tenant_name).filter(Boolean),
    ownerIds: [...new Set(data.map(row => row.owner_id).filter(Boolean))],
    unitCodes: [...new Set(data.map(row => row.unit_code).filter(Boolean))]
  }
}

const loadTenantScopedRows = async ({ supabase, moduleKey, definition, tenantScope, userId }) => {
  const { tenantIds, tenantNames, ownerIds, unitCodes } = tenantScope

  if (moduleKey === 'marketplace') {
    const result = await runQuery(createBaseQuery(supabase, definition).eq('status', 'vacant').limit(100))

    return {
      rows: result.data,
      error: result.error
    }
  }

  if (moduleKey === 'payments') {
    if (!tenantIds.length && !tenantNames.length) {
      return { rows: [], error: null }
    }

    const collected = []
    const errors = []
    let allowLegacyNameFallback = false

    if (tenantIds.length) {
      let invoiceQuery = supabase.from('invoices').select('id').in('tenant_id', tenantIds)

      if (ownerIds.length) {
        invoiceQuery = invoiceQuery.in('owner_id', ownerIds)
      }

      const byTenantInvoices = await runQuery(invoiceQuery)

      if (byTenantInvoices.error) {
        if (isColumnMissingError(byTenantInvoices.error)) {
          allowLegacyNameFallback = true
        } else {
          errors.push(byTenantInvoices.error)
        }
      } else {
        const invoiceIds = byTenantInvoices.data.map(row => row.id).filter(Boolean)

        if (invoiceIds.length) {
          let byInvoiceIdQuery = createBaseQuery(supabase, definition).in('invoice_id', invoiceIds).limit(50)

          if (ownerIds.length) {
            byInvoiceIdQuery = byInvoiceIdQuery.in('owner_id', ownerIds)
          }

          const byInvoiceId = await runQuery(byInvoiceIdQuery)

          if (byInvoiceId.error) {
            if (isColumnMissingError(byInvoiceId.error)) {
              allowLegacyNameFallback = true
            } else {
              errors.push(byInvoiceId.error)
            }
          } else {
            collected.push(...byInvoiceId.data)
          }
        }
      }
    }

    if (allowLegacyNameFallback && tenantNames.length) {
      let byNameQuery = createBaseQuery(supabase, definition).in('tenant_name', tenantNames).limit(50)

      if (ownerIds.length) {
        byNameQuery = byNameQuery.in('owner_id', ownerIds)
      }

      const byName = await runQuery(byNameQuery)

      if (byName.error) {
        errors.push(byName.error)
      } else {
        collected.push(...byName.data)
      }
    }

    return {
      rows: dedupeRows(collected),
      error: errors[0] || null
    }
  }

  if (moduleKey === 'invoices') {
    const collected = []
    const errors = []
    let allowLegacyNameFallback = false

    if (tenantIds.length) {
      let byTenantIdQuery = createBaseQuery(supabase, definition).in('tenant_id', tenantIds).limit(50)

      if (ownerIds.length) {
        byTenantIdQuery = byTenantIdQuery.in('owner_id', ownerIds)
      }

      const byTenantId = await runQuery(byTenantIdQuery)

      if (byTenantId.error) {
        if (isColumnMissingError(byTenantId.error)) {
          allowLegacyNameFallback = true
        } else {
          errors.push(byTenantId.error)
        }
      } else {
        collected.push(...byTenantId.data)
      }
    }

    if (allowLegacyNameFallback && tenantNames.length) {
      let byNameQuery = createBaseQuery(supabase, definition).in('tenant_name', tenantNames).limit(50)

      if (ownerIds.length) {
        byNameQuery = byNameQuery.in('owner_id', ownerIds)
      }

      const byName = await runQuery(byNameQuery)

      if (byName.error) {
        errors.push(byName.error)
      } else {
        collected.push(...byName.data)
      }
    }

    return {
      rows: dedupeRows(collected),
      error: errors[0] || null
    }
  }

  if (moduleKey === 'tenancies') {
    const collected = []
    const errors = []
    let allowLegacyNameFallback = false

    if (tenantIds.length) {
      let byTenantIdQuery = createBaseQuery(supabase, definition).in('tenant_id', tenantIds).limit(50)

      if (ownerIds.length) {
        byTenantIdQuery = byTenantIdQuery.in('owner_id', ownerIds)
      }

      const byTenantId = await runQuery(byTenantIdQuery)

      if (byTenantId.error) {
        if (isColumnMissingError(byTenantId.error)) {
          allowLegacyNameFallback = true
        } else {
          errors.push(byTenantId.error)
        }
      } else {
        collected.push(...byTenantId.data)
      }
    }

    if (allowLegacyNameFallback && tenantNames.length) {
      let byNameQuery = createBaseQuery(supabase, definition).in('tenant_name', tenantNames).limit(50)

      if (ownerIds.length) {
        byNameQuery = byNameQuery.in('owner_id', ownerIds)
      }

      const byName = await runQuery(byNameQuery)

      if (byName.error) {
        errors.push(byName.error)
      } else {
        collected.push(...byName.data)
      }
    }

    return {
      rows: dedupeRows(collected),
      error: errors[0] || null
    }
  }

  if (moduleKey === 'maintenance') {
    if (!tenantIds.length && !unitCodes.length) {
      return { rows: [], error: null }
    }

    let query = createBaseQuery(supabase, definition).limit(50)

    if (tenantIds.length) {
      query = query.in('tenant_id', tenantIds)
    }

    if (ownerIds.length) {
      query = query.in('owner_id', ownerIds)
    }

    const result = await runQuery(query)

    if (result.error) {
      if (!isColumnMissingError(result.error)) {
        return { rows: [], error: result.error }
      }

      if (!unitCodes.length) {
        return { rows: [], error: null }
      }

      let byUnitCodeQuery = createBaseQuery(supabase, definition).in('unit_code', unitCodes).limit(50)

      if (ownerIds.length) {
        byUnitCodeQuery = byUnitCodeQuery.in('owner_id', ownerIds)
      }

      const byUnitCode = await runQuery(byUnitCodeQuery)

      return {
        rows: byUnitCode.data,
        error: byUnitCode.error
      }
    }

    return { rows: result.data, error: result.error }
  }

  if (moduleKey === 'messaging') {
    let query = createBaseQuery(supabase, definition)
      .eq('owner_id', userId)
      .or(`sender_profile_id.eq.${userId},recipient_profile_id.eq.${userId}`)
      .limit(50)

    if (ownerIds.length) {
      query = query.in('owner_id', ownerIds)
    }

    const result = await runQuery(query)

    if (result.error && isColumnMissingError(result.error)) {
      return { rows: [], error: null }
    }

    return { rows: result.data, error: result.error }
  }

  if (moduleKey === 'documents') {
    const collected = []
    const errors = []

    if (tenantIds.length) {
      let byTenantIdQuery = createBaseQuery(supabase, definition).in('tenant_id', tenantIds).limit(50)

      if (ownerIds.length) {
        byTenantIdQuery = byTenantIdQuery.in('owner_id', ownerIds)
      }

      const byTenantId = await runQuery(byTenantIdQuery)

      if (byTenantId.error && !isColumnMissingError(byTenantId.error)) {
        errors.push(byTenantId.error)
      }

      collected.push(...byTenantId.data)
    }

    const byUploader = await runQuery(createBaseQuery(supabase, definition).eq('uploaded_by', userId).limit(50))

    if (byUploader.error && !isColumnMissingError(byUploader.error)) {
      errors.push(byUploader.error)
    }

    collected.push(...byUploader.data)

    return {
      rows: dedupeRows(collected),
      error: errors[0] || null
    }
  }

  return {
    rows: [],
    error: null
  }
}

const loadModuleRows = async ({ supabase, definition, moduleKey, role, userId }) => {
  if (role === USER_ROLES.ADMIN) {
    const result = await runQuery(createBaseQuery(supabase, definition).limit(50))

    return { rows: result.data, error: result.error }
  }

  if (role === USER_ROLES.TENANT) {
    const tenantScope = await getTenantScope(supabase, userId)

    if (tenantScope.error) {
      return { rows: [], error: tenantScope.error }
    }

    return loadTenantScopedRows({
      supabase,
      moduleKey,
      definition,
      tenantScope,
      userId
    })
  }

  const result = await runQuery(createBaseQuery(supabase, definition).eq('owner_id', userId).limit(50))

  return {
    rows: result.data,
    error: result.error
  }
}

export const getModulePageData = async moduleKey => {
  const fallback = getModuleFallback(moduleKey)

  if (!fallback) {
    return null
  }

  const definition = getModuleDefinition(moduleKey)

  if (!definition) {
    return {
      ...withSource(fallback, 'sample'),
      moduleKey,
      createFields: [],
      createEnabled: false
    }
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return {
      ...withSource(fallback, 'sample'),
      moduleKey,
      createFields: getModuleCreateFields(moduleKey),
      createEnabled: false
    }
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return {
      ...withSource(fallback, 'sample'),
      moduleKey,
      createFields: getModuleCreateFields(moduleKey),
      createEnabled: false
    }
  }

  let role = USER_ROLES.TENANT

  try {
    role = await resolveUserRole(supabase, user)
  } catch {
    role = USER_ROLES.TENANT
  }

  const createEnabled = canCreateModuleForRole(moduleKey, role)

  const gate = await evaluateModuleAccessGate({
    supabase,
    role,
    userId: user.id,
    moduleKey
  })

  if (!gate.allowed) {
    return {
      ...withSource(fallback, 'live'),
      moduleKey,
      rows: [],
      stats: withLiveStats(fallback, moduleKey, [], { scopeHint: resolveScopeHint(role) }),
      createFields: getModuleCreateFields(moduleKey),
      createEnabled: false
    }
  }

  try {
    const { rows, error } = await loadModuleRows({
      supabase,
      definition,
      moduleKey,
      role,
      userId: user.id
    })

    if (error) {
      const warning = resolveSchemaWarning(error)

      if (warning) {
        return {
          ...withSource(fallback, 'live'),
          moduleKey,
          rows: [],
          stats: withLiveStats(fallback, moduleKey, [], { scopeHint: resolveScopeHint(role) }),
          createFields: getModuleCreateFields(moduleKey),
          createEnabled,
          warning
        }
      }

      throw error
    }

    const transformedRows = definition.toRows ? definition.toRows(rows) : rows

    return {
      ...withSource(fallback, 'live'),
      moduleKey,
      rows: Array.isArray(transformedRows) ? transformedRows : [],
      stats: withLiveStats(fallback, moduleKey, transformedRows || [], { scopeHint: resolveScopeHint(role) }),
      createFields: getModuleCreateFields(moduleKey),
      createEnabled
    }
  } catch (error) {
    return {
      ...withSource(fallback, 'live'),
      moduleKey,
      rows: [],
      stats: withLiveStats(fallback, moduleKey, [], { scopeHint: resolveScopeHint(role) }),
      createFields: getModuleCreateFields(moduleKey),
      createEnabled,
      warning: resolveSchemaWarning(error)
    }
  }
}
