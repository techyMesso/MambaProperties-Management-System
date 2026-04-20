import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import {
  getAdminDashboardMetrics,
  getAgentDashboardMetrics,
  getLandlordDashboardMetrics,
  getTenantDashboardMetrics
} from '@/libs/dashboard/getDashboardMetrics'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const scopeLoaders = {
  admin: getAdminDashboardMetrics,
  landlord: getLandlordDashboardMetrics,
  agent: getAgentDashboardMetrics,
  tenant: getTenantDashboardMetrics
}

const roleToScope = {
  [USER_ROLES.ADMIN]: 'admin',
  [USER_ROLES.LANDLORD]: 'landlord',
  [USER_ROLES.AGENT]: 'agent',
  [USER_ROLES.TENANT]: 'tenant'
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
  const defaultScope = roleToScope[role] || 'tenant'
  const requestedScope = String(request.nextUrl.searchParams.get('scope') || '').trim().toLowerCase()
  const scope = requestedScope || defaultScope
  const isAdmin = defaultScope === 'admin'

  if (!scopeLoaders[scope]) {
    return API_RESPONSES.badRequest(request, 'Unsupported dashboard scope.')
  }

  // Admin can load cross-role dashboard scopes (landlord/agent/tenant) for role-view pages.
  if (scope !== defaultScope && !isAdmin) {
    return API_RESPONSES.forbidden(request, 'Forbidden scope for current user.')
  }

  const result = await scopeLoaders[scope]({
    supabase,
    userId: user.id
  })

  return API_RESPONSES.ok(
    request,
    {
      scope,
      metrics: result.metrics,
      error: result.error
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}
