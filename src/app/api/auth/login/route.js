import { API_RESPONSES } from '@/libs/api/apiResponses'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const toText = value => String(value || '').trim()

const normalizeEmail = value => toText(value).toLowerCase()
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const applyRateLimits = async (request, identifier) => {
  const perIp = await enforceRouteRateLimit(request, {
    scope: 'auth-login-ip',
    limit: 10,
    windowMs: 15 * 60_000,
    message: 'Too many sign-in attempts. Please wait and try again.'
  })

  if (perIp) {
    return perIp
  }

  if (!identifier) {
    return null
  }

  return enforceRouteRateLimit(request, {
    scope: 'auth-login-identifier',
    identifier,
    limit: 5,
    windowMs: 15 * 60_000,
    message: 'Too many sign-in attempts. Please wait and try again.'
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

  const identifier = normalizeEmail(body?.identifier)
  const password = toText(body?.password)

  if (!identifier || !password || !EMAIL_REGEX.test(identifier)) {
    return API_RESPONSES.badRequest(request, 'Email and password are required for this sign-in flow.')
  }

  const rateLimitError = await applyRateLimits(request, identifier)

  if (rateLimitError) {
    return rateLimitError
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: identifier,
    password
  })

  if (error || !data?.user?.id) {
    return API_RESPONSES.unauthorized(request, 'Invalid email, phone number, or password.')
  }

  return API_RESPONSES.ok(request, {
    authenticated: true,
    requiresProfileSync: true
  })
}
