import { API_RESPONSES } from '@/libs/api/apiResponses'
import { loadApprovalPendingState } from '@/libs/auth/loadApprovalPendingState'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

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

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'account-approval-status-get',
    identifier: user.id,
    limit: 90,
    windowMs: 60_000,
    message: 'Too many approval status checks. Please wait and try again.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  const state = await loadApprovalPendingState({
    supabase,
    userId: user.id
  })

  return API_RESPONSES.ok(
    request,
    {
      status: state
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    }
  )
}
