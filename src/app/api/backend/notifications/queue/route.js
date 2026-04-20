import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const ALLOWED_NOTIFICATION_ROLES = [USER_ROLES.ADMIN, USER_ROLES.LANDLORD, USER_ROLES.AGENT]

const normalizeChannels = value => {
  if (!Array.isArray(value)) {
    return ['sms', 'whatsapp']
  }

  const normalized = value
    .map(item => String(item || '').trim().toLowerCase())
    .filter(Boolean)
    .filter(item => ['sms', 'email', 'whatsapp', 'push', 'in_app'].includes(item))

  return normalized.length ? normalized : ['sms', 'whatsapp']
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

  const role = await resolveUserRole(supabase, user)

  if (!ALLOWED_NOTIFICATION_ROLES.includes(role)) {
    return API_RESPONSES.forbidden(request, 'Only admin, landlord, or agent can queue invoice notifications.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const period = String(body?.period || '').trim()

  if (!period) {
    return API_RESPONSES.badRequest(request, 'period is required.')
  }

  const requestedOwnerId = String(body?.ownerId || '').trim()
  const ownerId = requestedOwnerId || user.id

  if (ownerId !== user.id && role !== USER_ROLES.ADMIN) {
    return API_RESPONSES.forbidden(request, 'Only admins can queue notifications for other owners.')
  }

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'backend-notifications-queue',
    identifier: `${user.id}:${ownerId}`,
    limit: 20,
    windowMs: 10 * 60_000,
    message: 'Too many notification queue requests. Please wait and try again.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  const channels = normalizeChannels(body?.channels)

  const { data, error } = await supabase.rpc('queue_invoice_notifications', {
    p_owner_id: ownerId,
    p_period: period,
    p_channels: channels
  })

  if (error) {
    return API_RESPONSES.badRequest(request, error.message)
  }

  return API_RESPONSES.ok(request, {
    queued: Number(data || 0),
    ownerId,
    period,
    channels
  })
}
