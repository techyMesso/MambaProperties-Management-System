import 'server-only'

import { listActiveSubscriptionPlans } from '@/libs/pricing/subscriptionPlans'
import { safeQuery } from '@/libs/api/safeQuery'

const FEATURE_LABELS = {
  marketplace_listing: 'Marketplace Only',
  management_module: 'Management Module Only'
}

const PLAN_FEATURES = {
  landlord_marketplace: ['marketplace_listing'],
  landlord_management: ['management_module'],
  landlord_full_access: ['marketplace_listing', 'management_module']
}

const toText = value => String(value || '').trim()

const toNumber = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

const isLiveAccess = row => {
  if (row?.is_active !== true) {
    return false
  }

  if (!row?.expires_at) {
    return true
  }

  return new Date(row.expires_at) > new Date()
}

const inferPlanCode = activeFeatures => {
  const featureSet = new Set(activeFeatures.map(item => toText(item.feature)))

  if (featureSet.has('marketplace_listing') && featureSet.has('management_module')) {
    return 'landlord_full_access'
  }

  if (featureSet.has('marketplace_listing')) {
    return 'landlord_marketplace'
  }

  if (featureSet.has('management_module')) {
    return 'landlord_management'
  }

  return ''
}

export const loadLandlordSubscriptionOverview = async ({ supabase, userId }) => {
  if (!supabase || !userId) {
    return {
      activeFeatures: [],
      pendingFeatures: [],
      expiredFeatures: [],
      paymentHistory: [],
      currentPlan: null,
      recommendedPlanCode: 'landlord_full_access',
      availablePlans: []
    }
  }

  const [plans, featureResult, paymentsResult, profileResult] = await Promise.all([
    listActiveSubscriptionPlans(supabase),
    safeQuery(
      supabase
        .from('landlord_feature_access')
        .select('id,feature,is_active,expires_at,granted_at,paid_until,created_at,notes')
        .eq('landlord_id', userId)
        .order('created_at', { ascending: false })
    ),
    safeQuery(
      supabase
        .from('payments')
        .select('id,amount,status,paid_at,created_at,transaction_ref,channel_reference,metadata')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    safeQuery(supabase.from('profiles').select('id,full_name,role,requested_role,approval_status,kyc_verified').eq('id', userId).maybeSingle())
  ])

  const planMap = new Map(plans.map(plan => [toText(plan.planCode), plan]))
  const featureRows = Array.isArray(featureResult.data) ? featureResult.data : []

  const paymentRows = (Array.isArray(paymentsResult.data) ? paymentsResult.data : []).filter(
    row => toText(row?.metadata?.payment_kind).toLowerCase() === 'landlord_plan_subscription'
  )

  const mappedFeatures = featureRows.map(row => ({
    id: toText(row.id),
    feature: toText(row.feature),
    label: FEATURE_LABELS[toText(row.feature)] || toText(row.feature) || 'Feature access',
    isActive: row.is_active === true,
    isLive: isLiveAccess(row),
    expiresAt: row.expires_at || null,
    grantedAt: row.granted_at || null,
    createdAt: row.created_at || null
  }))

  const activeFeatures = mappedFeatures.filter(row => row.isLive)
  const pendingFeatures = mappedFeatures.filter(row => row.isActive !== true)
  const expiredFeatures = mappedFeatures.filter(row => row.isActive === true && row.isLive !== true)
  const inferredPlanCode = inferPlanCode(activeFeatures)
  const currentPlan = planMap.get(inferredPlanCode) || null

  const recommendedPlanCode =
    inferredPlanCode && inferredPlanCode !== 'landlord_full_access' ? 'landlord_full_access' : inferredPlanCode || 'landlord_full_access'

  const paymentHistory = paymentRows.map(row => ({
    id: toText(row.id),
    amount: toNumber(row.amount),
    status: toText(row.status).toLowerCase() || 'pending',
    paidAt: row.paid_at || null,
    createdAt: row.created_at || null,
    receiptNumber: toText(row.transaction_ref),
    planCode: toText(row?.metadata?.subscription_plan_code),
    planName: planMap.get(toText(row?.metadata?.subscription_plan_code))?.planName || 'Landlord plan'
  }))

  return {
    profile: profileResult.data || null,
    activeFeatures,
    pendingFeatures,
    expiredFeatures,
    paymentHistory,
    currentPlan,
    recommendedPlanCode,
    availablePlans: plans.filter(plan => ['landlord_agent', 'landlord', 'agent'].includes(toText(plan.audience).toLowerCase())),
    canUpgrade: inferredPlanCode && inferredPlanCode !== 'landlord_full_access',
    canRenew: Boolean(inferredPlanCode),
    currentPlanCode: inferredPlanCode || null
  }
}
