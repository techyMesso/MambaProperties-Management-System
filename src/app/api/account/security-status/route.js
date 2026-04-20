import { API_RESPONSES } from '@/libs/api/apiResponses'
import { getMfaPolicyState } from '@/libs/auth/mfaPolicy'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

export async function GET(request) {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return API_RESPONSES.unavailable(request, 'Supabase is not configured.')
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user?.id) {
    return API_RESPONSES.unauthorized(request, 'Authentication is required.')
  }

  const role = await resolveUserRole(supabase, user)

  const mfaPolicy = getMfaPolicyState({
    role,
    user
  })

  return API_RESPONSES.ok(request, {
    security: {
      role: mfaPolicy.role,
      mfaRequired: mfaPolicy.mfaRequired,
      factorsKnown: mfaPolicy.factorsKnown,
      hasVerifiedFactor: mfaPolicy.hasVerifiedFactor,
      verifiedFactorCount: mfaPolicy.verifiedFactorCount,
      recommendedAction: mfaPolicy.shouldPromptForSetup
        ? 'Set up an authenticator app to protect your account before using privileged dashboards.'
        : 'Your account security status is healthy.'
    }
  })
}
