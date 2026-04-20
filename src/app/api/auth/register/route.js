import { API_RESPONSES } from '@/libs/api/apiResponses'
import { USER_ROLES, isValidRole, normalizeRole } from '@/libs/auth/roles'
import { syncBasicProfile } from '@/libs/auth/profileSync'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const toText = value => String(value || '').trim()
const normalizeEmail = value => toText(value).toLowerCase()
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,72}$/

const applyRateLimits = async (request, identifier) => {
  const perIp = await enforceRouteRateLimit(request, {
    scope: 'auth-register-ip',
    limit: 8,
    windowMs: 30 * 60_000,
    message: 'Too many registration attempts. Please wait and try again.'
  })

  if (perIp) {
    return perIp
  }

  if (!identifier) {
    return null
  }

  return enforceRouteRateLimit(request, {
    scope: 'auth-register-email',
    identifier,
    limit: 3,
    windowMs: 30 * 60_000,
    message: 'Too many registration attempts. Please wait and try again.'
  })
}

const buildEmailConfirmationRedirect = (request, currentRole) => {
  const redirectUrl = new URL('/auth/confirm', request.url)
  const normalizedRole = normalizeRole(currentRole)

  const nextTarget =
    normalizedRole === USER_ROLES.TENANT
      ? '/tenant-dashboard?verified=1'
      : `/pricing?verified=1&audience=landlord&role=${normalizedRole || USER_ROLES.LANDLORD}&recommended=landlord_full_access`

  redirectUrl.searchParams.set('next', nextTarget)

  return redirectUrl.toString()
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

  const fullName = toText(body?.fullName)
  const email = normalizeEmail(body?.email)
  const phoneNumber = toText(body?.phoneNumber) || null
  const idNumber = toText(body?.idNumber) || null
  const occupation = toText(body?.occupation) || null
  const role = isValidRole(body?.role) ? normalizeRole(body.role) : ''
  const password = String(body?.password || '')
  const acceptTerms = body?.acceptTerms === true

  if (!fullName || !email || !EMAIL_REGEX.test(email) || !role || !acceptTerms || !STRONG_PASSWORD_REGEX.test(password)) {
    return API_RESPONSES.badRequest(
      request,
      'Provide a valid full name, email, strong password, selected role, and accept the platform terms.'
    )
  }

  const rateLimitError = await applyRateLimits(request, email)

  if (rateLimitError) {
    return rateLimitError
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phoneNumber,
        id_number: idNumber,
        occupation,
        requested_role: role
      },
      emailRedirectTo: buildEmailConfirmationRedirect(request, role)
    }
  })

  if (error) {
    return API_RESPONSES.conflict(request, 'Unable to create account with those details.')
  }

  if (data?.user?.id && data?.session) {
    await syncBasicProfile(supabase, data.user)

    return API_RESPONSES.created(request, {
      registered: true,
      authenticated: true,
      requiresProfileSync: true
    })
  }

  return API_RESPONSES.created(request, {
    registered: true,
    authenticated: false,
    requiresEmailVerification: true,
    message: 'If the details are valid, check your email to verify the account.'
  })
}
