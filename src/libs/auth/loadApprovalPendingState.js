import 'server-only'

import { getHomeForRole, isValidRole, normalizeRole, USER_ROLES } from './roles'

const FEATURE_LABELS = {
  marketplace_listing: 'Marketplace access',
  management_module: 'Management module'
}

const normalizeRequestedRole = profile => {
  const requestedRole = isValidRole(profile?.requested_role) ? normalizeRole(profile.requested_role) : null

  if (requestedRole) {
    return requestedRole
  }

  return isValidRole(profile?.role) ? normalizeRole(profile.role) : USER_ROLES.TENANT
}

const resolveDashboardPath = profile => {
  const role = isValidRole(profile?.role) ? normalizeRole(profile.role) : USER_ROLES.TENANT

  return getHomeForRole(role)
}

const mapFeatureAccess = rows =>
  (Array.isArray(rows) ? rows : []).map(item => ({
    id: item.id,
    feature: item.feature,
    label: FEATURE_LABELS[item.feature] || item.feature,
    isActive: item.is_active === true,
    expiresAt: item.expires_at || null,
    createdAt: item.created_at || null
  }))

export const loadApprovalPendingState = async ({ supabase, userId }) => {
  if (!supabase || !userId) {
    return {
      profile: null,
      featureAccess: [],
      latestLandlordPayment: null,
      requestedRole: USER_ROLES.TENANT,
      approvalStatus: 'pending',
      isApproved: false,
      hasPaidLandlordPlan: false,
      pendingFeatureCount: 0,
      activeFeatureCount: 0,
      dashboardPath: getHomeForRole(USER_ROLES.TENANT)
    }
  }

  const [{ data: profileData }, { data: featureData }, { data: paymentData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,full_name,role,requested_role,approval_status,kyc_verified')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('landlord_feature_access')
      .select('id,feature,is_active,expires_at,created_at')
      .eq('landlord_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id,status,amount,paid_at,created_at,metadata,channel_reference')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  const profile = profileData || null
  const featureAccess = mapFeatureAccess(featureData)

  const latestLandlordPayment =
    (paymentData || []).find(row => String(row?.metadata?.payment_kind || '').trim().toLowerCase() === 'landlord_plan_subscription') || null

  const requestedRole = normalizeRequestedRole(profile)
  const approvalStatus = String(profile?.approval_status || 'pending').trim().toLowerCase()
  const hasPaidLandlordPlan = String(latestLandlordPayment?.status || '').trim().toLowerCase() === 'paid'
  const pendingFeatureCount = featureAccess.filter(item => item.isActive !== true).length
  const activeFeatureCount = featureAccess.filter(item => item.isActive === true).length
  const isAdminApproved = approvalStatus === 'approved' && isValidRole(profile?.role) && normalizeRole(profile.role) !== USER_ROLES.TENANT
  const isApproved = isAdminApproved && activeFeatureCount > 0

  return {
    profile,
    featureAccess,
    latestLandlordPayment,
    requestedRole,
    approvalStatus,
    isAdminApproved,
    isApproved,
    hasPaidLandlordPlan,
    pendingFeatureCount,
    activeFeatureCount,
    dashboardPath: resolveDashboardPath(profile)
  }
}
