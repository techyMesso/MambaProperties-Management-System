import { API_RESPONSES } from '@/libs/api/apiResponses'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/libs/constants'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { canAccessPath } from '@/libs/auth/roles'
import { enforceSameOriginMutation, isStoragePathOwnedByUser } from '@/libs/security/requestGuards'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { canCreateModuleForRole, getModuleDefinition } from '@/libs/property/modules'
import { getModulePageData } from '@/libs/property/getModulePageData'
import { evaluateModuleAccessGate } from '@/libs/access/moduleGates'

const moduleRouteMap = {
  properties: '/properties',
  units: '/units',
  tenants: '/tenants',
  tenancies: '/tenancies',
  marketplace: '/marketplace',
  payments: '/payments',
  paymentsMonitoring: '/payments-monitoring',
  landlordLeads: '/landlord-leads',
  onboardingPipeline: '/onboarding-pipeline',
  invoices: '/invoices',
  maintenance: '/maintenance',
  messaging: '/messaging',
  documents: '/documents',
  reports: '/reports',
  subscriptions: '/subscriptions-plans',
  fees: '/fees-commissions',
  users: '/user-management',
  admin: '/admin'
}

const QUERYABLE_MODULES = new Set([
  'properties',
  'units',
  'tenants',
  'tenancies',
  'payments',
  'paymentsMonitoring',
  'landlordLeads',
  'invoices',
  'documents',
  'users',
  'admin'
])

const OWNER_SCOPED_ROLES = new Set(['landlord', 'agent'])
const DEFAULT_PAGE = 1

// DEFAULT_PAGE_SIZE and MAX_PAGE_SIZE imported from constants
const resolveRouteParams = async params => (params ? await params : {})

const queryableModuleConfig = {
  properties: {
    searchColumns: ['plot_id', 'name', 'location', 'manager'],
    filters: {
      status: 'availability_status',
      location: 'location'
    }
  },
  units: {
    searchColumns: ['unit_id', 'plot_id', 'category', 'status'],
    filters: {
      status: 'status',
      category: 'category',
      plotId: 'plot_id'
    }
  },
  tenants: {
    searchColumns: ['tenant_name', 'phone', 'occupation', 'unit_code'],
    filters: {
      paymentStatus: 'payment_status',
      unit: 'unit_code'
    }
  },
  tenancies: {
    searchColumns: ['agreement_id', 'tenant_name', 'unit_code', 'status'],
    filters: {
      status: 'status',
      unit: 'unit_code'
    }
  },
  payments: {
    searchColumns: ['receipt_no', 'tenant_name', 'channel', 'status'],
    filters: {
      status: 'status',
      channel: 'channel',
      tenant: 'tenant_name'
    }
  },
  paymentsMonitoring: {
    searchColumns: [
      'receipt_no',
      'tenant_name',
      'channel',
      'status',
      'transaction_ref',
      'channel_reference',
      'owner_id'
    ],
    filters: {
      status: 'status',
      channel: 'channel',
      tenant: 'tenant_name'
    }
  },
  landlordLeads: {
    searchColumns: ['full_name', 'phone', 'role', 'requested_role'],
    filters: {
      role: 'role',
      requestedRole: 'requested_role'
    }
  },
  invoices: {
    searchColumns: ['invoice_no', 'tenant_name', 'period', 'status'],
    filters: {
      status: 'status',
      tenant: 'tenant_name',
      period: 'period'
    }
  },
  documents: {
    searchColumns: ['doc_id', 'type', 'owner_name', 'status'],
    filters: {
      status: 'status',
      type: 'type',
      owner: 'owner_name'
    }
  },
  users: {
    searchColumns: ['full_name', 'phone', 'role', 'requested_role'],
    filters: {
      role: 'role',
      requestedRole: 'requested_role'
    }
  },
  admin: {
    searchColumns: ['entity', 'action', 'owner_name', 'status'],
    filters: {
      status: 'status',
      action: 'action',
      owner: 'owner_name'
    }
  }
}

const getModulePath = moduleKey => moduleRouteMap[moduleKey] || `/${moduleKey}`

const parseNumber = (value, fallback) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(1, Math.floor(parsed))
}

const sanitizeSearch = value =>
  String(value || '')
    .trim()
    .slice(0, 120)
    .replace(/[^\p{L}\p{N}\s@._-]+/gu, ' ')
    .replace(/\s+/g, ' ')

const isMissingColumnError = error => /column\b.+\bdoes not exist\b/i.test(String(error?.message || ''))

const parseQueryParams = request => {
  const searchParams = request.nextUrl.searchParams
  const page = parseNumber(searchParams.get('page'), DEFAULT_PAGE)
  const pageSize = Math.min(parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)
  const search = sanitizeSearch(searchParams.get('search'))
  const includeStats = searchParams.get('includeStats') === 'true'
  const filters = Object.fromEntries(searchParams.entries())

  return {
    page,
    pageSize,
    search,
    includeStats,
    filters
  }
}

const isPendingRequestedRoleFilter = (moduleKey, filters) => {
  if (moduleKey !== 'users') {
    return false
  }

  const value = String(filters?.requestedRole || '')
    .trim()
    .toLowerCase()

  return value === 'pending'
}

const applyServerFilters = (query, moduleKey, filters) => {
  const config = queryableModuleConfig[moduleKey]

  if (!config) {
    return query
  }

  Object.entries(config.filters).forEach(([queryKey, dbColumn]) => {
    const value = String(filters?.[queryKey] || '').trim()

    if (!value || value.toLowerCase() === 'all') {
      return
    }

    if (moduleKey === 'users' && queryKey === 'requestedRole' && value.toLowerCase() === 'pending') {
      query = query.not(dbColumn, 'is', null)

      return
    }

    query = query.eq(dbColumn, value)
  })

  return query
}

const applySearchFilter = (query, moduleKey, search) => {
  const config = queryableModuleConfig[moduleKey]

  if (!config || !search) {
    return query
  }

  const queryExpr = config.searchColumns.map(column => `${column}.ilike.%${search}%`).join(',')

  return query.or(queryExpr)
}

const shouldFilterDeactivatedProfiles = moduleKey => ['users', 'landlordLeads'].includes(moduleKey)

const applyDeactivatedFilter = (query, moduleKey, allowFilter = true) => {
  if (!allowFilter || !shouldFilterDeactivatedProfiles(moduleKey)) {
    return query
  }

  return query.or('account_status.is.null,account_status.neq.deactivated')
}

const queryModuleRows = async ({ supabase, definition, moduleKey, role, userId, page, pageSize, search, filters }) => {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const pendingRequestedRole = isPendingRequestedRoleFilter(moduleKey, filters)
  const fetchLimit = pendingRequestedRole ? 5000 : null

  const buildBaseQuery = () => {
    let query = supabase
      .from(definition.table)
      .select(definition.select, { count: pendingRequestedRole ? undefined : 'exact' })
      .order(definition.orderBy, { ascending: false })

    if (!pendingRequestedRole) {
      query = query.range(from, to)
    }

    return query
  }

  const executeQuery = async (withSearch, allowDeactivatedFilter = true) => {
    let query = buildBaseQuery()

    if (OWNER_SCOPED_ROLES.has(String(role || '').toLowerCase())) {
      query = query.eq('owner_id', userId)
    }

    query = applyDeactivatedFilter(query, moduleKey, allowDeactivatedFilter)

    if (moduleKey === 'landlordLeads') {
      query = query.or('role.eq.landlord,requested_role.eq.landlord')
    }

    query = applyServerFilters(query, moduleKey, filters)

    if (withSearch) {
      query = applySearchFilter(query, moduleKey, search)
    }

    if (pendingRequestedRole && fetchLimit) {
      query = query.limit(fetchLimit)
    }

    return query
  }

  let { data, error, count } = await executeQuery(true)

  if (error && shouldFilterDeactivatedProfiles(moduleKey) && isMissingColumnError(error)) {
    const fallbackResult = await executeQuery(true, false)

    data = fallbackResult.data
    error = fallbackResult.error
    count = fallbackResult.count
  }

  if (error && search && moduleKey === 'paymentsMonitoring' && isMissingColumnError(error)) {
    const fallbackResult = await executeQuery(false)

    data = fallbackResult.data
    error = fallbackResult.error
    count = fallbackResult.count
  }

  if (error) {
    return {
      rows: [],
      error,
      totalRows: 0,
      totalPages: 1
    }
  }

  if (pendingRequestedRole) {
    const filtered = (data || []).filter(row => {
      const roleValue = String(row?.role || '')
        .trim()
        .toLowerCase()

      const requestedRoleValue = String(row?.requested_role || row?.requestedRole || '')
        .trim()
        .toLowerCase()

      if (!requestedRoleValue) {
        return false
      }

      return requestedRoleValue !== roleValue
    })

    const totalRows = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    const rows = filtered.slice(from, to + 1)
    const transformedRows = definition?.toRows ? definition.toRows(rows) : rows

    return {
      rows: transformedRows,
      error: null,
      totalRows,
      totalPages
    }
  }

  const totalRows = Number.isFinite(count) ? count : 0
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const transformedRows = definition?.toRows ? definition.toRows(data || []) : data || []

  return {
    rows: transformedRows,
    error: null,
    totalRows,
    totalPages
  }
}

export async function GET(request, { params }) {
  const routeParams = await resolveRouteParams(params)
  const moduleKey = String(routeParams?.module || '').trim()
  const definition = getModuleDefinition(moduleKey)

  if (!definition) {
    return API_RESPONSES.notFound(request, 'Unsupported module.')
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
  const modulePath = getModulePath(moduleKey)

  if (!canAccessPath(modulePath, role)) {
    return API_RESPONSES.forbidden(request, 'Forbidden module for current user role.')
  }

  const gate = await evaluateModuleAccessGate({
    supabase,
    role,
    userId: user.id,
    moduleKey
  })

  if (!gate.allowed) {
    return API_RESPONSES.forbidden(request, gate.message)
  }

  const { page, pageSize, search, includeStats, filters } = parseQueryParams(request)
  const hasSearch = Boolean(search)

  const hasFilters = Object.entries(filters || {}).some(([key, value]) => {
    if (['page', 'pageSize', 'includeStats', 'search'].includes(key)) {
      return false
    }

    const normalized = String(value || '').trim().toLowerCase()

    return normalized && normalized !== 'all'
  })

  if (QUERYABLE_MODULES.has(moduleKey)) {
    const paged = await queryModuleRows({
      supabase,
      definition,
      moduleKey,
      role,
      userId: user.id,
      page,
      pageSize,
      search,
      filters
    })

    if (paged.error) {
      return API_RESPONSES.badRequest(request, paged.error.message || 'Failed to load module rows.')
    }

    let stats = []
    let dataSource = 'live'

    if (includeStats) {
      const pageData = await getModulePageData(moduleKey)

      stats = pageData?.stats || []
      dataSource = pageData?.dataSource || dataSource

      if (moduleKey === 'documents' && (hasSearch || hasFilters) && Array.isArray(stats) && stats[0]) {
        stats = stats.map((item, index) =>
          index === 0
            ? {
                ...item,
                value: String(paged.totalRows),
                hint: 'Live records in database (filtered)'
              }
            : item
        )
      }
    }

    return API_RESPONSES.ok(
      request,
      {
        moduleKey,
        rows: paged.rows,
        stats,
        dataSource,
        pagination: {
          page,
          pageSize,
          totalRows: paged.totalRows,
          totalPages: paged.totalPages
        }
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=0, must-revalidate'
        }
      }
    )
  }

  const pageData = await getModulePageData(moduleKey)

  if (!pageData) {
    return API_RESPONSES.notFound(request, 'Module data not found.')
  }

  return API_RESPONSES.ok(
    request,
    {
      moduleKey: pageData.moduleKey,
      rows: pageData.rows,
      stats: pageData.stats,
      dataSource: pageData.dataSource,
      pagination: {
        page: 1,
        pageSize: pageData.rows?.length || 0,
        totalRows: pageData.rows?.length || 0,
        totalPages: 1
      }
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}

export async function POST(request, { params }) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const routeParams = await resolveRouteParams(params)
  const moduleKey = String(routeParams?.module || '').trim()
  const definition = getModuleDefinition(moduleKey)

  if (!definition || !definition.toInsert) {
    return API_RESPONSES.badRequest(request, 'Unsupported module for create operation.')
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
  const modulePath = getModulePath(moduleKey)

  if (!canAccessPath(modulePath, role)) {
    return API_RESPONSES.forbidden(request, 'Forbidden module for current user role.')
  }

  const gate = await evaluateModuleAccessGate({
    supabase,
    role,
    userId: user.id,
    moduleKey
  })

  if (!gate.allowed) {
    return API_RESPONSES.forbidden(request, gate.message)
  }

  if (!canCreateModuleForRole(moduleKey, role)) {
    return API_RESPONSES.forbidden(request, 'Create action is disabled for this module and role.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const values = body?.values || {}

  if (moduleKey === 'documents') {
    const filePath = String(values?.filePath || '').trim()

    if (filePath && role !== 'admin' && !isStoragePathOwnedByUser(filePath, user.id)) {
      return API_RESPONSES.badRequest(request, 'Document file path must belong to your account.')
    }
  }

  try {
    const insertRecord = {
      ...definition.toInsert(values),
      owner_id: user.id
    }

    const { data, error } = await supabase.from(definition.table).insert(insertRecord).select('id').maybeSingle()

    if (error) {
      return API_RESPONSES.badRequest(request, error.message)
    }

    return API_RESPONSES.created(request, { recordId: data?.id ?? null })
  } catch (error) {
    return API_RESPONSES.internal(request, error?.message || 'Failed to create record.')
  }
}
