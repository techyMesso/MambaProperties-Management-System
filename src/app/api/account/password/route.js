import { API_RESPONSES } from '@/libs/api/apiResponses'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { getSupabaseEnv } from '@/libs/supabase/env'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const toText = value => String(value || '').trim()
const PASSWORD_POLICY_MESSAGE = 'Password must be at least 12 characters and include uppercase, lowercase, and a number.'

const hasStrongPassword = value => {
  const text = toText(value)

  return text.length >= 12 && /[a-z]/.test(text) && /[A-Z]/.test(text) && /\d/.test(text)
}

const verifyCurrentPassword = async ({ email, currentPassword }) => {
  const env = getSupabaseEnv({ required: false })

  if (!env || !email) {
    return {
      ok: false,
      reason: 'reauth_unavailable'
    }
  }

  const verifier = createSupabaseClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })

  try {
    const { error } = await verifier.auth.signInWithPassword({
      email,
      password: currentPassword
    })

    await verifier.auth.signOut().catch(() => {})

    if (error) {
      return {
        ok: false,
        reason: 'invalid_password'
      }
    }

    return {
      ok: true,
      reason: null
    }
  } catch {
    return {
      ok: false,
      reason: 'reauth_failed'
    }
  }
}

export async function PATCH(request) {
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
    scope: 'account-password-patch',
    identifier: user.id,
    limit: 8,
    windowMs: 10 * 60_000,
    message: 'Too many password update attempts. Please wait and try again.'
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

  const newPassword = toText(body?.newPassword)
  const confirmPassword = toText(body?.confirmPassword)
  const currentPassword = toText(body?.currentPassword)

  if (!currentPassword) {
    return API_RESPONSES.badRequest(request, 'Current password is required.')
  }

  if (!newPassword) {
    return API_RESPONSES.badRequest(request, 'New password is required.')
  }

  if (newPassword.length > 72) {
    return API_RESPONSES.badRequest(request, 'Password is too long.')
  }

  if (!hasStrongPassword(newPassword)) {
    return API_RESPONSES.badRequest(request, PASSWORD_POLICY_MESSAGE)
  }

  if (!confirmPassword) {
    return API_RESPONSES.badRequest(request, 'Password confirmation is required.')
  }

  if (confirmPassword !== newPassword) {
    return API_RESPONSES.badRequest(request, 'Password confirmation does not match.')
  }

  if (user.email) {
    const verification = await verifyCurrentPassword({
      email: user.email,
      currentPassword
    })

    if (!verification.ok) {
      if (verification.reason === 'reauth_unavailable') {
        return API_RESPONSES.unavailable(request, 'Password verification is temporarily unavailable.')
      }

      if (verification.reason === 'invalid_password') {
        return API_RESPONSES.badRequest(request, 'Current password is incorrect.')
      }

      return API_RESPONSES.badRequest(request, 'Unable to verify the current password.')
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) {
    return API_RESPONSES.badRequest(request, error.message || 'Unable to update password.')
  }

  return API_RESPONSES.ok(request, { updated: true })
}
