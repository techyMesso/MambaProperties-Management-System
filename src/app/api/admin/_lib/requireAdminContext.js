import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

export const requireAdminContext = async (request, { enforceMutationOrigin = false } = {}) => {
  if (enforceMutationOrigin) {
    const originError = enforceSameOriginMutation(request)

    if (originError) {
      return {
        error: originError
      }
    }
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return {
      error: API_RESPONSES.unavailable(request, 'Supabase is not configured.')
    }
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return {
      error: API_RESPONSES.unauthorized(request)
    }
  }

  const role = await resolveUserRole(supabase, user)

  if (role !== USER_ROLES.ADMIN) {
    return {
      error: API_RESPONSES.forbidden(request, 'Only admin accounts can perform this action.')
    }
  }

  const adminSupabase = createAdminClient()
  const requireServiceRole = enforceMutationOrigin === true

  if (requireServiceRole && !adminSupabase) {
    return {
      error: API_RESPONSES.unavailable(
        request,
        'SUPABASE_SERVICE_ROLE_KEY is required for admin write actions. Configure it and restart the server.'
      )
    }
  }

  return {
    supabase,

    // Fallback to regular client for read operations; null for mutations requires service role check above
    adminSupabase: adminSupabase || (!requireServiceRole ? supabase : null),
    user
  }
}
