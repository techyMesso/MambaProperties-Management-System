import { API_RESPONSES } from '@/libs/api/apiResponses'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { createAdminClient } from '@/libs/supabase/admin'
import { createAuthPerfLogger } from '@/libs/auth/perf'
import { resolvePostAuthRedirect } from '@/libs/auth/postAuthRedirect'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { isValidRole, normalizeRole, USER_ROLES } from '@/libs/auth/roles'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { getTenantSubscriptionPricing } from '@/libs/pricing/subscriptionPlans'

const SELF_SERVICE_ROLES = new Set([USER_ROLES.TENANT])
const PRIVILEGED_SELF_SERVICE_ROLES = new Set([USER_ROLES.LANDLORD, USER_ROLES.AGENT])
const PRIVILEGED_ROLES = new Set([USER_ROLES.ADMIN, USER_ROLES.LANDLORD, USER_ROLES.AGENT])

const ALLOW_PRIVILEGED_SELF_SERVICE =
  process.env.NODE_ENV !== 'production' && process.env.ALLOW_SELF_SERVICE_PRIVILEGED_ROLES === '1'

const normalizeSubscriptionStatus = value => (typeof value === 'string' ? value.trim().toLowerCase() : '')

const canSelfServiceAssignRole = requestedRole => {
  if (SELF_SERVICE_ROLES.has(requestedRole)) {
    return true
  }

  return ALLOW_PRIVILEGED_SELF_SERVICE && PRIVILEGED_SELF_SERVICE_ROLES.has(requestedRole)
}

const syncSelfServiceRole = async ({ user, requestedRole }) => {
  if (!canSelfServiceAssignRole(requestedRole)) {
    return {
      role: null,
      warning: 'Role request saved. Admin approval is required before this role is activated.'
    }
  }

  const adminSupabase = createAdminClient()

  if (!adminSupabase) {
    return {
      role: null,
      warning: null
    }
  }

  const [{ error: profileRoleError }, { error: authRoleError }] = await Promise.all([
    adminSupabase.from('profiles').update({ role: requestedRole, requested_role: requestedRole }).eq('id', user.id),
    adminSupabase.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...(user.app_metadata || {}),
        role: requestedRole
      }
    })
  ])

  if (profileRoleError || authRoleError) {
    return {
      role: null,
      warning: profileRoleError?.message || authRoleError?.message || 'Unable to sync requested role.'
    }
  }

  return {
    role: requestedRole,
    warning: null
  }
}

const ensureTenantHouseSearchSubscription = async (supabase, userId) => {
  const result = {
    created: false,
    status: 'none',
    paymentStatus: 'unpaid',
    warning: null
  }

  const { data: existing, error: existingError } = await supabase
    .from('tenant_subscriptions')
    .select('id,status,payment_status')
    .eq('user_id', userId)
    .eq('subscription_type', 'house_search')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) {
    result.warning = existingError.message || 'Unable to read tenant subscription status.'

    return result
  }

  if (existing?.id) {
    result.status = normalizeSubscriptionStatus(existing.status) || 'pending'
    result.paymentStatus = normalizeSubscriptionStatus(existing.payment_status) || 'unpaid'

    return result
  }

  const pricing = await getTenantSubscriptionPricing(supabase, 'house_search')

  const expiresAt = new Date()

  expiresAt.setDate(expiresAt.getDate() + (pricing.duration_days || 30))

  const { data: created, error: createError } = await supabase
    .from('tenant_subscriptions')
    .insert({
      user_id: userId,
      subscription_type: 'house_search',
      status: 'pending',
      payment_status: 'unpaid',
      amount_due: pricing.amount,
      currency: pricing.currency || 'KES',
      expires_at: expiresAt.toISOString()
    })
    .select('id,status,payment_status')
    .maybeSingle()

  if (createError) {
    result.warning = createError.message || 'Unable to create tenant subscription.'

    return result
  }

  result.created = Boolean(created?.id)
  result.status = normalizeSubscriptionStatus(created?.status) || 'pending'
  result.paymentStatus = normalizeSubscriptionStatus(created?.payment_status) || 'unpaid'

  return result
}

export async function POST(request) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const supabase = await createServerSupabaseClient()
  const perf = createAuthPerfLogger('api.auth.sync-profile')
  const traceRequested = process.env.NODE_ENV !== 'production' && request?.headers?.get('x-auth-perf') === '1'
  let perfFinalized = false

  const finalizePerf = status => {
    if (perfFinalized) {
      return null
    }

    perfFinalized = true

    return perf.done({ status })
  }

  const withTimingPayload = (payload, status) => {
    const timings = finalizePerf(status)

    if (!traceRequested || !timings) {
      return payload
    }

    return {
      ...payload,
      timings
    }
  }

  const respondSuccess = (payload, status = 200) => API_RESPONSES.ok(request, withTimingPayload(payload, status), { status })

  const respondError = (status, message) => {
    const timings = finalizePerf(status)
    const details = traceRequested && timings ? { timings } : null

    return API_RESPONSES.fromError(
      request,
      {
        status,
        message,
        details
      },
      {
        status,
        message: message || 'Request failed.',
        details
      }
    )
  }

  if (!supabase) {
    perf.mark('missing-supabase-client')

    return respondError(503, 'Supabase is not configured.')
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  perf.mark('auth-get-user-finished', { hasUser: Boolean(user?.id) })

  if (!user?.id) {
    return respondError(401, 'Unauthorized')
  }

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'auth-sync-profile',
    identifier: user.id,
    limit: 24,
    windowMs: 60_000,
    message: 'Too many profile sync attempts. Please try again in a minute.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  let role = await resolveUserRole(supabase, user)

  perf.mark('resolve-role-finished', { role })

  const requestedRole = isValidRole(user.user_metadata?.requested_role)
    ? normalizeRole(user.user_metadata.requested_role)
    : null

  const profilePayload = {
    id: user.id,
    full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Account',
    phone: user.user_metadata?.phone ?? null,
    id_number: user.user_metadata?.id_number ?? null,
    occupation: user.user_metadata?.occupation ?? null
  }

  if (requestedRole) {
    profilePayload.requested_role = requestedRole
  }

  const { error } = await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })

  perf.mark('profile-upsert-finished', { hasError: Boolean(error) })

  if (error) {
    return respondError(400, error.message)
  }

  const canApplyRequestedRole = requestedRole && (!PRIVILEGED_ROLES.has(role) || requestedRole === role)

  const roleSync = canApplyRequestedRole ? await syncSelfServiceRole({ user, requestedRole }) : { role: null, warning: null }

  perf.mark('role-sync-finished', {
    updatedRole: Boolean(roleSync.role),
    hasWarning: Boolean(roleSync.warning),
    skipped: Boolean(requestedRole && !canApplyRequestedRole),
    role,
    requestedRole
  })

  if (roleSync.role) {
    role = roleSync.role
  }

  let landlordSubscription = { activated: false, warning: null, autoCreated: false }
  let tenantSubscription = { created: false, status: 'none', paymentStatus: 'unpaid', warning: null }

  if (role === USER_ROLES.LANDLORD) {
    landlordSubscription = {
      activated: false,
      warning: null,
      autoCreated: false
    }

    perf.mark('landlord-subscription-finished', {
      activated: landlordSubscription.activated,
      hasWarning: Boolean(landlordSubscription.warning)
    })
  }

  if (role === USER_ROLES.TENANT) {
    tenantSubscription = await ensureTenantHouseSearchSubscription(supabase, user.id)
    perf.mark('tenant-subscription-finished', {
      created: tenantSubscription.created,
      status: tenantSubscription.status,
      paymentStatus: tenantSubscription.paymentStatus,
      hasWarning: Boolean(tenantSubscription.warning)
    })
  }

  const redirectTo = await resolvePostAuthRedirect({ supabase, user, resolvedRole: role })

  return respondSuccess({
    role,
    redirectTo,
    landlordSubscription,
    tenantSubscription,
    roleSyncWarning: roleSync.warning
  })
}
