import { API_RESPONSES } from '@/libs/api/apiResponses'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const DEACTIVATION_PHRASE = 'DEACTIVATE MY ACCOUNT'

const toText = value => String(value || '').trim()

const toBoolean = value => value === true

const isMissingColumnError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const normalizeReason = value => {
  const next = toText(value)

  if (!next) {
    return null
  }

  return next.slice(0, 300)
}

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

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'account-deactivate-post',
    identifier: user.id,
    limit: 3,
    windowMs: 30 * 60_000,
    message: 'Too many deactivation attempts. Please try again later.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const acknowledged = toBoolean(body?.acknowledged)
  const confirmation = toText(body?.confirmation)
  const reason = normalizeReason(body?.reason)

  if (!acknowledged) {
    return API_RESPONSES.badRequest(request, 'Please confirm account deactivation before continuing.')
  }

  if (confirmation !== DEACTIVATION_PHRASE) {
    return API_RESPONSES.badRequest(request, `Type "${DEACTIVATION_PHRASE}" to confirm deactivation.`)
  }

  const adminSupabase = createAdminClient()

  if (!adminSupabase) {
    return API_RESPONSES.unavailable(request, 'Admin Supabase client is not configured.')
  }

  const deactivatedAt = new Date().toISOString()

  const metadata = {
    ...(user.user_metadata || {}),
    account_deactivated: true,
    account_deactivated_at: deactivatedAt,
    account_deactivated_reason: reason
  }

  const authResult = await adminSupabase.auth.admin.updateUserById(user.id, {
    ban_duration: '876000h',
    user_metadata: metadata
  })

  if (authResult.error) {
    return API_RESPONSES.badRequest(request, authResult.error.message || 'Unable to deactivate account.')
  }

  const profileUpdate = await adminSupabase
    .from('profiles')
    .update({
      account_status: 'deactivated',
      deactivated_at: deactivatedAt,
      deactivation_reason: reason
    })
    .eq('id', user.id)
    .select('id')
    .maybeSingle()

  if (profileUpdate.error && !isMissingColumnError(profileUpdate.error)) {
    console.error('Failed to update profile deactivation fields:', profileUpdate.error)
  }

  // Best-effort sign-out on the current session so middleware stops treating the request as authenticated.
  try {
    await supabase.auth.signOut()
  } catch {
    // Do not block deactivation success if session cleanup fails.
  }

  // Best-effort audit log for compliance traceability.
  await supabase.from('admin_audit_logs').insert({
    owner_id: user.id,
    actor_id: user.id,
    entity: 'account',
    action: 'self-deactivate',
    owner_name: toText(user.user_metadata?.full_name || user.email || 'Admin User'),
    status: 'completed'
  })

  return API_RESPONSES.ok(request, {
    deactivated: true,
    message: 'Your account has been deactivated. Sign in is now blocked.',
    deactivatedAt
  })
}
