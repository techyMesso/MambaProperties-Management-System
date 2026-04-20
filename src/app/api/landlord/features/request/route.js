import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { USER_ROLES, isValidRole, normalizeRole } from '@/libs/auth/roles'
import { calculatePlatformFees } from '@/libs/payments/platformFees'
import { getMpesaConfig, initiateMpesaStkPush, normalizeKenyanPhone } from '@/libs/payments/mpesa'
import { getLandlordFeaturePricing } from '@/libs/pricing/subscriptionPlans'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createAdminClient } from '@/libs/supabase/admin'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const toText = value => String(value || '').trim()

const LANDLORD_ELIGIBLE_ROLES = new Set([USER_ROLES.LANDLORD, USER_ROLES.AGENT])

const PLAN_FEATURE_MAP = {
  landlord_marketplace: ['marketplace_listing'],
  marketplace_listing: ['marketplace_listing'],
  landlord_management: ['management_module'],
  management_module: ['management_module'],
  landlord_full_access: ['marketplace_listing', 'management_module'],
  full_access: ['marketplace_listing', 'management_module']
}

const getRequestedRole = profile => {
  const normalizedRequestedRole = isValidRole(profile?.requested_role) ? normalizeRole(profile.requested_role) : null

  if (LANDLORD_ELIGIBLE_ROLES.has(normalizedRequestedRole)) {
    return normalizedRequestedRole
  }

  const normalizedRole = isValidRole(profile?.role) ? normalizeRole(profile.role) : null

  if (LANDLORD_ELIGIBLE_ROLES.has(normalizedRole)) {
    return normalizedRole
  }

  return null
}

const resolvePlanFeatures = feature => PLAN_FEATURE_MAP[toText(feature).toLowerCase()] || null

const toIsoDateAfterDays = durationDays => {
  const expiresAt = new Date()

  expiresAt.setDate(expiresAt.getDate() + Math.max(Number(durationDays) || 0, 0))

  return expiresAt.toISOString()
}

const hasLiveAccess = record => {
  if (!record?.is_active) {
    return false
  }

  if (!record?.expires_at) {
    return true
  }

  return new Date(record.expires_at) > new Date()
}

const loadExistingAccess = async ({ writer, userId, features }) =>
  safeQuery(writer.from('landlord_feature_access').select('id,feature,is_active,expires_at').eq('landlord_id', userId).in('feature', features))

const createFeatureAccessRows = async ({ writer, userId, features, expiresAt, requestedRole, planCode }) =>
  safeQuery(
    writer
      .from('landlord_feature_access')
      .insert(
        features.map(feature => ({
          landlord_id: userId,
          feature,
          expires_at: expiresAt,
          paid_until: expiresAt,
          is_active: false,
          notes: JSON.stringify({
            requestedRole,
            planCode,
            status: 'awaiting_mpesa_payment'
          }),
          created_at: new Date().toISOString()
        }))
      )
      .select('id,feature,expires_at,is_active')
  )

const createPendingPayment = async ({
  writer,
  userId,
  profile,
  amount,
  feeSummary,
  mpesaResponse,
  planCode,
  requestedRole,
  features,
  featureAccessIds
}) =>
  safeQuery(
    writer
      .from('payments')
      .insert({
        owner_id: userId,
        tenant_name: profile?.full_name || requestedRole || 'Landlord',
        channel: 'M-Pesa STK',
        amount,
        status: 'pending',
        transaction_ref: mpesaResponse.MerchantRequestID || null,
        channel_reference: mpesaResponse.CheckoutRequestID || null,
        payment_purpose: 'landlord_plan_subscription',
        related_feature_access_id: featureAccessIds[0] || null,
        metadata: {
          provider: 'mpesa',
          payment_kind: 'landlord_plan_subscription',
          subscription_plan_code: planCode,
          base_amount: feeSummary?.baseAmount ?? amount,
          fee_amount: feeSummary?.totalFee ?? 0,
          fee_breakdown: feeSummary?.rules || [],
          requested_role: requestedRole,
          feature_access_ids: featureAccessIds,
          features,
          provider_response: {
            MerchantRequestID: mpesaResponse.MerchantRequestID || null,
            CheckoutRequestID: mpesaResponse.CheckoutRequestID || null,
            ResponseCode: mpesaResponse.ResponseCode || null,
            ResponseDescription: mpesaResponse.ResponseDescription || null,
            CustomerMessage: mpesaResponse.CustomerMessage || null
          }
        }
      })
      .select('id')
      .maybeSingle()
  )

const buildPaymentGatewayErrorDetails = ({
  pricing,
  feature,
  amount,
  feeSummary,
  phoneNumber,
  requestedRole
}) => ({
  provider: 'mpesa',
  feature,
  featureName: pricing.name,
  amount,
  currency: feeSummary.currency,
  baseAmount: feeSummary.baseAmount,
  feeAmount: feeSummary.totalFee,
  feeBreakdown: feeSummary.rules,
  duration_days: pricing.duration_days,
  description: pricing.description,
  phoneNumber,
  requestedRole,
  nextAction: 'payment_failed',
  paymentStatus: 'not_started'
})

export async function POST(request) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'landlord-plan-request',
    limit: 5,
    windowMs: 60_000,
    message: 'Too many landlord subscription attempts. Please wait a minute.'
  })

  if (rateLimitError) {
    return rateLimitError
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

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const requestedPlan = toText(body?.feature).toLowerCase()
  const phoneNumber = toText(body?.phoneNumber)
  const features = resolvePlanFeatures(requestedPlan)
  const pricing = requestedPlan ? await getLandlordFeaturePricing(supabase, requestedPlan) : null

  if (!requestedPlan || !features?.length || !pricing || pricing.price === null || pricing.price === undefined) {
    return API_RESPONSES.badRequest(request, 'Invalid plan. Allowed: landlord_marketplace, landlord_management, landlord_full_access.')
  }

  if (!phoneNumber || phoneNumber.length < 9) {
    return API_RESPONSES.badRequest(request, 'Valid phone number required.')
  }

  const normalizedPhone = normalizeKenyanPhone(phoneNumber)

  if (!normalizedPhone) {
    return API_RESPONSES.badRequest(request, 'Use a valid Kenyan M-Pesa number like 0712345678 or 254712345678.')
  }

  const feeSummary = await calculatePlatformFees({
    supabase,
    baseAmount: pricing.price,
    currency: pricing.currency || 'KES',
    scopeCandidates: ['subscription', 'landlord_subscription', 'landlord_plan_subscription', requestedPlan, pricing.planCode]
  })

  const payableAmount = feeSummary.totalAmount

  const adminSupabase = createAdminClient()
  const writer = adminSupabase || supabase

  const profileResult = await safeQuery(
    writer.from('profiles').select('id,full_name,phone,role,requested_role,approval_status,kyc_verified').eq('id', user.id).maybeSingle()
  )

  if (profileResult.error) {
    return API_RESPONSES.badRequest(request, profileResult.error.message || 'Unable to load landlord profile.')
  }

  const profile = profileResult.data
  const requestedRole = getRequestedRole(profile)

  if (!requestedRole) {
    return API_RESPONSES.forbidden(request, 'Only landlord or agent onboarding accounts can request landlord plans.')
  }

  const existingResult = await loadExistingAccess({
    writer,
    userId: user.id,
    features
  })

  if (existingResult.error) {
    return API_RESPONSES.badRequest(request, existingResult.error.message || 'Unable to verify existing landlord access.')
  }

  const existingAccess = existingResult.data || []
  const alreadyActive = existingAccess.find(record => hasLiveAccess(record))

  if (alreadyActive) {
    return API_RESPONSES.badRequest(request, `You already have active ${pricing.name} access.`)
  }

  const pendingAccess = existingAccess.filter(record => !record.is_active).map(record => record.id).filter(Boolean)

  if (pendingAccess.length) {
    await writer.from('landlord_feature_access').delete().in('id', pendingAccess).eq('landlord_id', user.id)
  }

  const expiresAt = toIsoDateAfterDays(pricing.duration_days || 365)

  const accessResult = await createFeatureAccessRows({
    writer,
    userId: user.id,
    features,
    expiresAt,
    requestedRole,
    planCode: pricing.planCode || requestedPlan
  })

  if (accessResult.error) {
    return API_RESPONSES.badRequest(request, accessResult.error.message || 'Unable to create landlord plan request.')
  }

  const accessRows = accessResult.data || []
  const featureAccessIds = accessRows.map(item => item.id).filter(Boolean)

  let mpesaResult = null
  let mpesaError = null

  try {
    const mpesaConfig = getMpesaConfig()

    if (mpesaConfig.consumerKey) {
      mpesaResult = await initiateMpesaStkPush({
        config: mpesaConfig,
        phoneNumber: normalizedPhone,
        amount: payableAmount,
        accountReference: `PLAN-${requestedPlan}-${user.id.slice(0, 8)}`,
        description: `${pricing.name} subscription payment`
      })
    }
  } catch (error) {
    mpesaError = error.message
    console.error('STK Push error:', mpesaError)
  }

  if (mpesaResult?.CheckoutRequestID) {
    const paymentResult = await createPendingPayment({
      writer,
      userId: user.id,
      profile,
      amount: payableAmount,
      feeSummary,
      mpesaResponse: mpesaResult,
      planCode: pricing.planCode || requestedPlan,
      requestedRole,
      features,
      featureAccessIds
    })

    if (paymentResult.error) {
      await writer.from('landlord_feature_access').delete().in('id', featureAccessIds).eq('landlord_id', user.id)

      return API_RESPONSES.badRequest(request, paymentResult.error.message || 'Unable to record landlord payment request.')
    }
  } else {
    await writer.from('landlord_feature_access').delete().in('id', featureAccessIds).eq('landlord_id', user.id)

    return API_RESPONSES.badGateway(
      request,
      mpesaError || 'Unable to initiate the M-Pesa STK push for this landlord plan.',
      buildPaymentGatewayErrorDetails({
        pricing,
        feature: requestedPlan,
        amount: payableAmount,
        feeSummary,
        phoneNumber,
        requestedRole
      })
    )
  }

  const responseData = {
    accessIds: mpesaResult?.CheckoutRequestID ? featureAccessIds : [],
    feature: requestedPlan,
    featureName: pricing.name,
    amount: payableAmount,
    currency: feeSummary.currency,
    baseAmount: feeSummary.baseAmount,
    feeAmount: feeSummary.totalFee,
    feeBreakdown: feeSummary.rules,
    duration_days: pricing.duration_days,
    description: pricing.description,
    includedFeatures: features,
    status: mpesaResult ? 'pending_payment' : 'pending',
    phoneNumber,
    userName: profile?.full_name || 'Landlord',
    approvalStatus: profile?.approval_status || 'pending',
    requestedRole
  }

  if (mpesaResult?.CheckoutRequestID) {
    responseData.checkoutRequestId = mpesaResult.CheckoutRequestID
    responseData.customerMessage = mpesaResult.CustomerMessage || 'STK push sent to your phone'
    responseData.nextAction = 'enter_pin'
  } else {
    responseData.nextAction = mpesaError ? 'payment_failed' : 'initiate_m_pesa_payment'

    if (mpesaError) {
      responseData.paymentError = mpesaError
    }
  }

  return API_RESPONSES.accepted(request, responseData)
}
