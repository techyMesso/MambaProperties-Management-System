import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const toText = value => String(value || '').trim()

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isAllowedRole = role => [USER_ROLES.ADMIN, USER_ROLES.LANDLORD, USER_ROLES.AGENT].includes(role)

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

  if (!isAllowedRole(role)) {
    return API_RESPONSES.forbidden(request, 'Only landlord, agent, or admin accounts can grant tenant portal access.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const tenantId = toText(body?.tenantId)
  const tenantEmail = toText(body?.tenantEmail)
  const authUserId = toText(body?.authUserId)

  if (!tenantId) {
    return API_RESPONSES.badRequest(request, 'Tenant id is required.')
  }

  if (!tenantEmail && !authUserId) {
    return API_RESPONSES.badRequest(request, 'Provide the tenant email or auth user id to grant access.')
  }

  let targetUserId = authUserId

  if (targetUserId && !UUID_REGEX.test(targetUserId)) {
    return API_RESPONSES.badRequest(request, 'Auth user id must be a valid UUID.')
  }

  if (!targetUserId) {
    const adminSupabase = createAdminClient()

    if (!adminSupabase) {
      return API_RESPONSES.unavailable(request, 'SUPABASE_SERVICE_ROLE_KEY is required to look up tenant accounts.')
    }

    const { data, error } = await adminSupabase.auth.admin.getUserByEmail(tenantEmail)

    if (error || !data?.user?.id) {
      return API_RESPONSES.badRequest(request, 'Tenant account not found. Ask the tenant to sign up first.')
    }

    targetUserId = data.user.id
  }

  if (role !== USER_ROLES.ADMIN) {
    const { data: tenantRow, error: tenantError } = await supabase
      .from('tenants')
      .select('id, owner_id')
      .eq('id', tenantId)
      .eq('owner_id', user.id)
      .maybeSingle()

    if (tenantError) {
      return API_RESPONSES.badRequest(request, tenantError.message || 'Unable to verify tenant ownership.')
    }

    if (!tenantRow?.id) {
      return API_RESPONSES.forbidden(request, 'You can only grant access to tenants in your portfolio.')
    }
  }

  const { error: updateError } = await supabase
    .from('tenants')
    .update({ auth_user_id: targetUserId })
    .eq('id', tenantId)

  if (updateError) {
    return API_RESPONSES.badRequest(request, updateError.message || 'Unable to grant tenant portal access.')
  }

  return API_RESPONSES.ok(request, {
    tenantId,
    authUserId: targetUserId,
    message: 'Tenant portal access granted.'
  })
}
