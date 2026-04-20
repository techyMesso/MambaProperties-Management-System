import { API_RESPONSES } from '@/libs/api/apiResponses'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const toText = value => String(value || '').trim()
const normalizeEmail = value => toText(value).toLowerCase()
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const applyRateLimits = async (request, identifier) => {
  const perIp = await enforceRouteRateLimit(request, {
    scope: 'auth-forgot-password-ip',
    limit: 5,
    windowMs: 30 * 60_000,
    message: 'Too many password reset requests. Please wait and try again.'
  })

  if (perIp) {
    return perIp
  }

  if (!identifier) {
    return null
  }

  return enforceRouteRateLimit(request, {
    scope: 'auth-forgot-password-email',
    identifier,
    limit: 3,
    windowMs: 30 * 60_000,
    message: 'Too many password reset requests. Please wait and try again.'
  })
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

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const email = normalizeEmail(body?.email)

  if (!email || !EMAIL_REGEX.test(email)) {
    return API_RESPONSES.badRequest(request, 'A valid email address is required.')
  }

  const rateLimitError = await applyRateLimits(request, email)

  if (rateLimitError) {
    return rateLimitError
  }

  const redirectTo = new URL('/reset-password', request.url).toString()

  await supabase.auth
    .resetPasswordForEmail(email, {
      redirectTo
    })
    .catch(() => {})

  return API_RESPONSES.ok(request, {
    requested: true,
    message: 'If an account exists for that email, a reset link has been sent.'
  })
}
