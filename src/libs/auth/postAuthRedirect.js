import { buildMfaSetupPath, getMfaPolicyState } from './mfaPolicy'
import { DEFAULT_ROLE, getHomeForRole, isValidRole, normalizeRole, USER_ROLES } from './roles'

const LANDLORD_ONBOARDING_ROLES = new Set([USER_ROLES.LANDLORD, USER_ROLES.AGENT])

export const buildLandlordPricingPath = role => {
  const normalizedRole = LANDLORD_ONBOARDING_ROLES.has(normalizeRole(role)) ? normalizeRole(role) : USER_ROLES.LANDLORD

  return `/pricing?audience=landlord&role=${normalizedRole}&recommended=landlord_full_access`
}

const resolveRequestedRole = (profile, user) => {
  const profileRequestedRole = profile?.requested_role

  if (isValidRole(profileRequestedRole)) {
    return normalizeRole(profileRequestedRole)
  }

  const metadataRequestedRole = user?.user_metadata?.requested_role

  if (isValidRole(metadataRequestedRole)) {
    return normalizeRole(metadataRequestedRole)
  }

  return null
}

const hasRequestedLandlordRole = role => LANDLORD_ONBOARDING_ROLES.has(normalizeRole(role))

const getLandlordPlanState = async (supabase, userId) => {
  if (!supabase || !userId) {
    return {
      hasAnyPlanRequest: false,
      hasLiveAccess: false
    }
  }

  const { data, error } = await supabase
    .from('landlord_feature_access')
    .select('id,is_active,expires_at')
    .eq('landlord_id', userId)
    .limit(20)

  if (error) {
    return {
      hasAnyPlanRequest: false,
      hasLiveAccess: false
    }
  }

  const rows = Array.isArray(data) ? data : []
  const now = new Date()

  const hasLiveAccess = rows.some(item => {
    if (item?.is_active !== true) {
      return false
    }

    if (!item?.expires_at) {
      return true
    }

    return new Date(item.expires_at) > now
  })

  return {
    hasAnyPlanRequest: rows.length > 0,
    hasLiveAccess
  }
}

export const resolvePostAuthRedirect = async ({ supabase, user, resolvedRole }) => {
  const fallbackRole = isValidRole(resolvedRole) ? normalizeRole(resolvedRole) : DEFAULT_ROLE

  if (!supabase || !user?.id) {
    return getHomeForRole(fallbackRole)
  }

  const profileResult = await supabase.from('profiles').select('role,requested_role,approval_status').eq('id', user.id).maybeSingle()
  const profile = profileResult.error ? null : profileResult.data
  const effectiveRole = isValidRole(profile?.role) ? normalizeRole(profile.role) : fallbackRole
  const requestedRole = resolveRequestedRole(profile, user)
  const approvalStatus = String(profile?.approval_status || '').trim().toLowerCase()
  const planState = await getLandlordPlanState(supabase, user.id)

  const mfaPolicy = getMfaPolicyState({
    role: effectiveRole,
    user
  })

  if (mfaPolicy.canEnforceSetup) {
    return buildMfaSetupPath(getHomeForRole(effectiveRole))
  }

  if (hasRequestedLandlordRole(requestedRole)) {
    if (approvalStatus === 'approved' && hasRequestedLandlordRole(effectiveRole) && planState.hasLiveAccess) {
      return getHomeForRole(effectiveRole)
    }

    if (planState.hasAnyPlanRequest) {
      return '/approval-pending'
    }

    return buildLandlordPricingPath(requestedRole)
  }

  if (hasRequestedLandlordRole(effectiveRole) && approvalStatus && approvalStatus !== 'approved') {
    return '/approval-pending'
  }

  if (hasRequestedLandlordRole(effectiveRole) && approvalStatus === 'approved' && !planState.hasLiveAccess) {
    return planState.hasAnyPlanRequest ? '/approval-pending' : buildLandlordPricingPath(effectiveRole)
  }

  return getHomeForRole(effectiveRole)
}
