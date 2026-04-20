import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { listTableColumns } from '@/app/api/admin/_lib/tableColumns'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'

const isRelationshipError = error => {
  const message = String(error?.message || '').toLowerCase()

  return (
    message.includes('relationship') ||
    message.includes('schema cache') ||
    message.includes('foreign key') ||
    message.includes('could not find')
  )
}

const isMissingColumnError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const isMissingRelationError = error => {
  const message = String(error?.message || '').toLowerCase()

  return (message.includes('relation') || message.includes('table')) && message.includes('does not exist')
}

const isSchemaIntrospectionError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('information_schema') || message.includes('permission') || message.includes('does not exist')
}

const PROFILE_COLUMNS = ['id', 'full_name', 'phone', 'role', 'requested_role', 'approval_status', 'kyc_verified', 'created_at', 'email', 'account_status']
const PROFILE_FALLBACK_COLUMNS = ['id', 'full_name', 'phone', 'role', 'requested_role', 'approval_status', 'kyc_verified', 'created_at', 'account_status']

const MANAGEMENT_ROLES = new Set(['landlord', 'agent'])

const resolveManagementRole = profile => {
  const requestedRole = String(profile?.requested_role || '')
    .trim()
    .toLowerCase()

  const role = String(profile?.role || '')
    .trim()
    .toLowerCase()

  if (MANAGEMENT_ROLES.has(requestedRole)) {
    return requestedRole
  }

  if (MANAGEMENT_ROLES.has(role)) {
    return role
  }

  return role || requestedRole
}

export async function GET(request) {
  const context = await requireAdminContext(request)

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'admin-landlords-pending',
    identifier: user.id,
    limit: 60,
    windowMs: 60_000
  })

  if (rateLimitError) {
    return rateLimitError
  }

  try {
    let profileColumns

    try {
      profileColumns = await listTableColumns(adminSupabase, 'profiles')
    } catch (error) {
      if (isSchemaIntrospectionError(error)) {
        profileColumns = new Set(PROFILE_FALLBACK_COLUMNS)
      } else {
        throw error
      }
    }

    const selectableProfileColumns = PROFILE_COLUMNS.filter(column => profileColumns.has(column))
    const baseSelect = selectableProfileColumns.join(',')

    const buildBaseQuery = (selectClause = baseSelect) =>
      adminSupabase
        .from('profiles')
        .select(selectClause)
        .or('role.eq.landlord,role.eq.agent,requested_role.eq.landlord,requested_role.eq.agent')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })

    let landlordsResult = await safeQuery(buildBaseQuery(`${baseSelect},plots ( count )`), { fallbackData: [] })

    if (landlordsResult.error && isRelationshipError(landlordsResult.error)) {
      landlordsResult = await safeQuery(buildBaseQuery(), { fallbackData: [] })
    }

    if (landlordsResult.error && isMissingColumnError(landlordsResult.error)) {
      const fallbackSelect = PROFILE_FALLBACK_COLUMNS.filter(column => profileColumns.has(column)).join(',')

      landlordsResult = await safeQuery(
        buildBaseQuery(fallbackSelect || 'id,full_name,phone,role,approval_status,kyc_verified,created_at'),
        { fallbackData: [] }
      )
    }

    if (landlordsResult.error) {
      if (isMissingColumnError(landlordsResult.error) || isMissingRelationError(landlordsResult.error)) {
        return API_RESPONSES.ok(request, {
          count: 0,
          landlords: [],
          warning: 'Landlord approval schema is not initialized. Run the latest migration.'
        })
      }

      return API_RESPONSES.badRequest(request, landlordsResult.error.message)
    }

    const visibleLandlords = landlordsResult.data.filter(l => String(l?.account_status || '').trim().toLowerCase() !== 'deactivated')

    return API_RESPONSES.ok(request, {
      count: visibleLandlords.length,
      landlords: visibleLandlords.map(l => ({
        id: l.id,
        name: l.full_name,
        phone: l.phone,
        email: l.email,
        role: resolveManagementRole(l),
        status: l.approval_status,
        kyc_verified: l.kyc_verified,
        plots_count: l.plots?.[0]?.count || 0,
        registered: l.created_at
      }))
    })
  } catch (error) {
    return API_RESPONSES.internal(request, error.message)
  }
}
