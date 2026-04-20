import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const ALLOWED_INVOICE_ROLES = [USER_ROLES.ADMIN, USER_ROLES.LANDLORD, USER_ROLES.AGENT]

const toOptionalDate = value => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
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

  if (!ALLOWED_INVOICE_ROLES.includes(role)) {
    return API_RESPONSES.forbidden(request, 'Only admin, landlord, or agent can generate invoices.')
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
    return API_RESPONSES.forbidden(request, 'Only admins can generate invoices for other owners.')
  }

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'backend-invoice-generate',
    identifier: `${user.id}:${ownerId}`,
    limit: 20,
    windowMs: 10 * 60_000,
    message: 'Too many invoice generation requests. Please wait and try again.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  const dueDate = toOptionalDate(body?.dueDate)

  const { data, error } = await supabase.rpc('generate_monthly_invoices', {
    p_owner_id: ownerId,
    p_period: period,
    p_due_date: dueDate
  })

  if (error) {
    return API_RESPONSES.badRequest(request, error.message)
  }

  return API_RESPONSES.ok(request, {
    generated: Number(data || 0),
    ownerId,
    period,
    dueDate
  })
}
