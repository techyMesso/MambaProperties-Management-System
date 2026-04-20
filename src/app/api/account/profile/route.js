import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const toText = value => String(value || '').trim()

const isMissingColumnError = error => /column\s+"?.+"?\s+does not exist/i.test(String(error?.message || ''))

const buildAvatarUrl = avatarPath => {
  const safePath = toText(avatarPath)

  if (!safePath) {
    return ''
  }

  return `/api/storage/documents/download?path=${encodeURIComponent(safePath)}&download=0`
}

const normalizePhone = value => {
  const input = toText(value)

  if (!input) {
    return null
  }

  const digitsOnly = input.replace(/[^\d]/g, '')

  if (!digitsOnly) {
    return null
  }

  return `+${digitsOnly}`
}

const toProfilePayload = ({ currentProfile, body }) => {
  const fallbackFullName = toText(currentProfile?.full_name || '')
  const fallbackPhone = toText(currentProfile?.phone || '')
  const fallbackIdNumber = toText(currentProfile?.id_number || '')
  const fallbackOccupation = toText(currentProfile?.occupation || '')

  const fullNameInput = toText(body?.fullName)
  const phoneInput = body?.phone
  const idNumberInput = body?.idNumber
  const occupationInput = body?.occupation

  const fullName = fullNameInput || fallbackFullName
  const phone = phoneInput === undefined ? normalizePhone(fallbackPhone) : normalizePhone(phoneInput)
  const idNumber = idNumberInput === undefined ? fallbackIdNumber || null : toText(idNumberInput) || null
  const occupation = occupationInput === undefined ? fallbackOccupation || null : toText(occupationInput) || null

  return {
    full_name: fullName || null,
    phone,
    id_number: idNumber,
    occupation
  }
}

const runQuery = safeQuery

const readProfileRow = async (supabase, userId) => {
  const selectVariants = [
    'full_name,phone,id_number,occupation,avatar_path',
    'full_name,phone,id_number,occupation',
    'full_name,phone,occupation',
    'full_name,phone'
  ]

  let lastError = null
  let fallbackTriggered = false

  for (const select of selectVariants) {
    const result = await runQuery(supabase.from('profiles').select(select).eq('id', userId).maybeSingle())

    if (!result.error) {
      return {
        ...result,
        fallbackTriggered
      }
    }

    lastError = result.error

    if (!isMissingColumnError(result.error)) {
      return {
        ...result,
        fallbackTriggered
      }
    }

    fallbackTriggered = true
  }

  return {
    data: null,
    error: lastError,
    fallbackTriggered
  }
}

const readTenantMappings = async ({ supabase, userId }) => {
  const query = supabase
    .from('tenants')
    .select('id,tenant_name,unit_code')
    .eq('auth_user_id', userId)
    .order('tenant_name', { ascending: true })
    .limit(50)

  const result = await runQuery(query)

  if (!result.error) {
    return {
      data: Array.isArray(result.data)
        ? result.data.map(row => ({
            id: row.id,
            tenantName: toText(row.tenant_name || ''),
            unitCode: toText(row.unit_code || '')
          }))
        : [],
      warning: null
    }
  }

  if (isMissingColumnError(result.error)) {
    return {
      data: [],
      warning: 'Tenant mappings are unavailable until all tenant schema columns are migrated.'
    }
  }

  return {
    data: [],
    warning: 'Tenant mappings are temporarily unavailable.'
  }
}

const upsertProfileRow = async ({ supabase, userId, payload }) => {
  const attempts = [
    {
      select: 'full_name,phone,id_number,occupation',
      values: {
        id: userId,
        full_name: payload.full_name,
        phone: payload.phone,
        id_number: payload.id_number,
        occupation: payload.occupation
      }
    },
    {
      select: 'full_name,phone,occupation',
      values: {
        id: userId,
        full_name: payload.full_name,
        phone: payload.phone,
        occupation: payload.occupation
      }
    },
    {
      select: 'full_name,phone,id_number',
      values: {
        id: userId,
        full_name: payload.full_name,
        phone: payload.phone,
        id_number: payload.id_number
      }
    },
    {
      select: 'full_name,phone',
      values: {
        id: userId,
        full_name: payload.full_name,
        phone: payload.phone
      }
    }
  ]

  let lastError = null
  let fallbackTriggered = false

  for (const attempt of attempts) {
    const result = await runQuery(supabase.from('profiles').upsert(attempt.values, { onConflict: 'id' }).select(attempt.select).maybeSingle())

    if (!result.error) {
      return {
        ...result,
        fallbackTriggered
      }
    }

    lastError = result.error

    if (!isMissingColumnError(result.error)) {
      return {
        ...result,
        fallbackTriggered
      }
    }

    fallbackTriggered = true
  }

  return {
    data: null,
    error: lastError,
    fallbackTriggered
  }
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

  const readRateLimitError = await enforceRouteRateLimit(request, {
    scope: 'account-profile-get',
    identifier: user.id,
    limit: 120,
    windowMs: 60_000,
    message: 'Too many profile requests. Please wait and try again.'
  })

  if (readRateLimitError) {
    return readRateLimitError
  }

  const role = await resolveUserRole(supabase, user)
  const profileResult = await readProfileRow(supabase, user.id)

  if (profileResult.error) {
    return API_RESPONSES.badRequest(request, profileResult.error.message || 'Unable to load profile.')
  }

  let tenantMappings = []
  let warning = profileResult.fallbackTriggered ? 'Some profile fields are unavailable until all migrations are applied.' : null

  if (role === 'tenant') {
    const mappings = await readTenantMappings({
      supabase,
      userId: user.id
    })

    tenantMappings = mappings.data
    warning = warning || mappings.warning
  }

  const profile = profileResult.data || {}
  const fullName = toText(profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account')
  const phone = toText(profile?.phone || user.user_metadata?.phone || '')
  const idNumber = toText(profile?.id_number || user.user_metadata?.id_number || '')
  const occupation = toText(profile?.occupation || user.user_metadata?.occupation || '')
  const avatarPath = toText(profile?.avatar_path || user.user_metadata?.avatar_path || '')
  const avatarUrl = buildAvatarUrl(avatarPath) || toText(user.user_metadata?.avatar_url || '')

  return API_RESPONSES.ok(
    request,
    {
      profile: {
        fullName,
        email: toText(user.email),
        phone,
        idNumber,
        occupation,
        role,
        avatarPath,
        avatarUrl
      },
      tenantMappings,
      warning
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=0, must-revalidate'
      }
    }
  )
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

  const writeRateLimitError = await enforceRouteRateLimit(request, {
    scope: 'account-profile-patch',
    identifier: user.id,
    limit: 20,
    windowMs: 5 * 60_000,
    message: 'Too many profile updates. Please wait and try again.'
  })

  if (writeRateLimitError) {
    return writeRateLimitError
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const currentProfileResult = await readProfileRow(supabase, user.id)

  if (currentProfileResult.error) {
    return API_RESPONSES.badRequest(request, currentProfileResult.error.message || 'Unable to load current profile.')
  }

  const payload = toProfilePayload({
    currentProfile: currentProfileResult.data,
    body
  })

  if (!payload.full_name || payload.full_name.length < 2) {
    return API_RESPONSES.badRequest(request, 'Full name must be at least 2 characters.')
  }

  if (payload.full_name.length > 120) {
    return API_RESPONSES.badRequest(request, 'Full name is too long.')
  }

  if (payload.phone && payload.phone.length > 30) {
    return API_RESPONSES.badRequest(request, 'Phone number is too long.')
  }

  const profileUpdateResult = await upsertProfileRow({
    supabase,
    userId: user.id,
    payload
  })

  if (profileUpdateResult.error) {
    return API_RESPONSES.badRequest(request, profileUpdateResult.error.message || 'Unable to save profile changes.')
  }

  let authWarning = profileUpdateResult.fallbackTriggered
    ? 'Profile saved, but some fields are unavailable until all migrations are applied.'
    : null

  const authMetadata = {
    ...(user.user_metadata || {}),
    full_name: payload.full_name,
    phone: payload.phone,
    id_number: payload.id_number,
    occupation: payload.occupation
  }

  const authUpdate = await supabase.auth.updateUser({
    data: authMetadata
  })

  if (authUpdate.error) {
    authWarning = authUpdate.error.message || 'Profile saved, but auth metadata did not refresh.'
  }

  return API_RESPONSES.ok(request, {
    warning: authWarning,
    profile: {
      fullName: toText(profileUpdateResult.data?.full_name || payload.full_name),
      email: toText(user.email),
      phone: toText(profileUpdateResult.data?.phone || payload.phone || ''),
      idNumber: toText(profileUpdateResult.data?.id_number || payload.id_number || ''),
      occupation: toText(profileUpdateResult.data?.occupation || payload.occupation || ''),
      avatarPath: toText(currentProfileResult.data?.avatar_path || user.user_metadata?.avatar_path || ''),
      avatarUrl:
        buildAvatarUrl(toText(currentProfileResult.data?.avatar_path || user.user_metadata?.avatar_path || '')) ||
        toText(user.user_metadata?.avatar_url || '')
    }
  })
}
