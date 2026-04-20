import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { enforceSameOriginMutation } from '@/libs/security/requestGuards'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { DEFAULT_CURRENCY } from '@/libs/constants'
import { getMpesaConfig, initiateMpesaStkPush, normalizeKenyanPhone } from '@/libs/payments/mpesa'
import { calculatePlatformFees } from '@/libs/payments/platformFees'
import { getTenantSubscriptionPricing } from '@/libs/pricing/subscriptionPlans'

const toText = value => String(value || '').trim()

const updatePendingSubscriptionCheckout = async ({ supabase, subscriptionId, checkoutRequestId }) => {
  if (!subscriptionId || !checkoutRequestId) {
    return
  }

  await supabase
    .from('tenant_subscriptions')
    .update({
      payment_reference: checkoutRequestId,
      payment_method: 'mpesa'
    })
    .eq('id', subscriptionId)
}

const appendFeeSummary = (responseData, feeSummary) => {
  if (!feeSummary) {
    return responseData
  }

  return {
    ...responseData,
    baseAmount: feeSummary.baseAmount,
    feeAmount: feeSummary.totalFee,
    totalAmount: feeSummary.totalAmount,
    feeBreakdown: feeSummary.rules
  }
}

const buildPaymentGatewayErrorDetails = ({
  pricing,
  subscriptionId,
  amount,
  currency,
  subscriptionType,
  phoneNumber,
  feeSummary = null
}) =>
  appendFeeSummary(
    {
      provider: 'mpesa',
      subscriptionId,
      amount,
      currency: currency || 'KES',
      subscriptionType,
      subscriptionName: pricing.name,
      duration_days: pricing.duration_days,
      features: pricing.features,
      phoneNumber,
      nextAction: 'payment_failed',
      paymentStatus: 'not_started'
    },
    feeSummary
  )

export async function POST(request) {
  const originError = enforceSameOriginMutation(request)

  if (originError) {
    return originError
  }

  const rateLimitError = await enforceRouteRateLimit(request, {
    limit: 5,
    windowMs: 60_000, // 5 requests per minute max
    scope: 'tenant-subscription-initiate'
  })

  if (rateLimitError) return rateLimitError

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

  if (role !== USER_ROLES.TENANT) {
    return API_RESPONSES.forbidden(request, 'Only tenant accounts can initiate tenant subscriptions.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const subscriptionType = toText(body?.subscriptionType)
  const phoneNumber = toText(body?.phoneNumber)
  const pricing = subscriptionType ? await getTenantSubscriptionPricing(supabase, subscriptionType) : null

  if (!subscriptionType || !pricing) {
    return API_RESPONSES.badRequest(
      request,
      'Invalid subscription type. Allowed: house_search.'
    )
  }

  if (!phoneNumber || phoneNumber.length < 9) {
    return API_RESPONSES.badRequest(request, 'Valid phone number required.')
  }

  const normalizedPhone = normalizeKenyanPhone(phoneNumber)

  if (!normalizedPhone) {
    return API_RESPONSES.badRequest(request, 'Use a valid Kenyan M-Pesa number like 0712345678 or 254712345678.')
  }

  try {
    const feeSummary = await calculatePlatformFees({
      supabase,
      baseAmount: pricing.amount,
      currency: pricing.currency || DEFAULT_CURRENCY,
      scopeCandidates: ['subscription', 'tenant_subscription', subscriptionType, pricing.planCode]
    })

    // Check for active subscription
    const { data: existing } = await supabase
      .from('tenant_subscriptions')
      .select('id, status, payment_status, expires_at, amount_due, currency, payment_reference')
      .eq('user_id', user.id)
      .eq('subscription_type', subscriptionType)
      .in('status', ['active', 'trial', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Check if still valid
      if (
        ['active', 'trial'].includes(String(existing.status || '').toLowerCase()) &&
        (!existing.expires_at || new Date(existing.expires_at) > new Date())
      ) {
        return API_RESPONSES.badRequest(
          request,
          `You already have an active ${pricing.name} subscription.`
        )
      }

      if (String(existing.status || '').toLowerCase() === 'pending') {
        const existingAmount = Number(existing.amount_due)
        const payableAmount = Number.isFinite(existingAmount) && existingAmount > 0 ? existingAmount : feeSummary.totalAmount

        if (toText(existing.payment_reference)) {
          return API_RESPONSES.ok(
            request,
            appendFeeSummary(
              {
                subscriptionId: existing.id,
                amount: payableAmount,
                currency: existing.currency || feeSummary.currency,
                subscriptionType,
                subscriptionName: pricing.name,
                duration_days: pricing.duration_days,
                features: pricing.features,
                status: 'pending_payment',
                phoneNumber,
                userName: user.email?.split('@')[0] || 'User',
                checkoutRequestId: existing.payment_reference,
                nextAction: 'complete_existing_payment',
                message: 'A previous M-Pesa prompt is still pending. Complete that payment or wait for it to expire before retrying.'
              },
              feeSummary
            )
          )
        }

        let mpesaResult = null
        let mpesaError = null

        try {
          const mpesaConfig = getMpesaConfig()

          mpesaResult = await initiateMpesaStkPush({
            config: mpesaConfig,
            phoneNumber: normalizedPhone,
            amount: payableAmount,
            accountReference: `SUB-${existing.id.slice(0, 8)}`,
            description: `${pricing.name} subscription payment`
          })
        } catch (error) {
          mpesaError = error.message
          console.error('STK Push error:', mpesaError)
        }

        const responseData = appendFeeSummary(
          {
            subscriptionId: existing.id,
            amount: payableAmount,
            currency: existing.currency || feeSummary.currency,
            subscriptionType,
            subscriptionName: pricing.name,
            duration_days: pricing.duration_days,
            features: pricing.features,
            status: mpesaResult ? 'pending_payment' : 'pending',
            phoneNumber,
            userName: user.email?.split('@')[0] || 'User'
          },
          feeSummary
        )

        if (mpesaResult?.CheckoutRequestID) {
          await updatePendingSubscriptionCheckout({
            supabase,
            subscriptionId: existing.id,
            checkoutRequestId: mpesaResult.CheckoutRequestID
          })

          responseData.checkoutRequestId = mpesaResult.CheckoutRequestID
          responseData.customerMessage = mpesaResult.CustomerMessage || 'STK push sent to your phone'
          responseData.nextAction = 'enter_pin'
        } else {
          const paymentError =
            mpesaError || 'We saved the subscription request, but the M-Pesa STK push was not sent. Check M-Pesa setup and try again.'

          return API_RESPONSES.badGateway(
            request,
            paymentError,
            buildPaymentGatewayErrorDetails({
              pricing,
              subscriptionId: existing.id,
              amount: payableAmount,
              currency: existing.currency || feeSummary.currency,
              subscriptionType,
              phoneNumber,
              feeSummary
            })
          )
        }

        return API_RESPONSES.accepted(request, responseData)
      }
    }

    const expiresAt = new Date()

    expiresAt.setDate(expiresAt.getDate() + pricing.duration_days)

    // Create subscription record (pending payment)
    const { data: subscription, error: subError } = await supabase
      .from('tenant_subscriptions')
      .insert({
        user_id: user.id,
        subscription_type: subscriptionType,
        status: 'pending',
        payment_status: 'unpaid',
        amount_due: feeSummary.totalAmount,
        currency: feeSummary.currency,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (subError) {
      return API_RESPONSES.badRequest(request, subError.message)
    }

    // Get user profile for reference
    const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle()

    // Auto-trigger STK Push for subscription payment
    let mpesaResult = null
    let mpesaError = null

    try {
      const mpesaConfig = getMpesaConfig()

      mpesaResult = await initiateMpesaStkPush({
        config: mpesaConfig,
        phoneNumber: normalizedPhone,
        amount: feeSummary.totalAmount,
        accountReference: `SUB-${subscription.id.slice(0, 8)}`,
        description: `${pricing.name} subscription payment`
      })
    } catch (error) {
      mpesaError = error.message
      console.error('STK Push error:', mpesaError)
    }

    const responseData = appendFeeSummary(
      {
        subscriptionId: subscription.id,
        amount: feeSummary.totalAmount,
        currency: feeSummary.currency,
        subscriptionType,
        subscriptionName: pricing.name,
        duration_days: pricing.duration_days,
        features: pricing.features,
        status: mpesaResult ? 'pending_payment' : 'pending',
        phoneNumber,
        userName: profile?.full_name || 'User'
      },
      feeSummary
    )

    // Add STK Push result if successful
    if (mpesaResult?.CheckoutRequestID) {
      await updatePendingSubscriptionCheckout({
        supabase,
        subscriptionId: subscription.id,
        checkoutRequestId: mpesaResult.CheckoutRequestID
      })

      responseData.checkoutRequestId = mpesaResult.CheckoutRequestID
      responseData.customerMessage = mpesaResult.CustomerMessage || 'STK push sent to your phone'
      responseData.nextAction = 'enter_pin'
    } else {
      const paymentError =
        mpesaError || 'We saved the subscription request, but the M-Pesa STK push was not sent. Check M-Pesa setup and try again.'

      return API_RESPONSES.badGateway(
        request,
        paymentError,
        buildPaymentGatewayErrorDetails({
          pricing,
          subscriptionId: subscription.id,
          amount: feeSummary.totalAmount,
          currency: feeSummary.currency,
          subscriptionType,
          phoneNumber,
          feeSummary
        })
      )
    }

    return API_RESPONSES.accepted(request, responseData)
  } catch (error) {
    console.error('Error initiating subscription:', error)

    return API_RESPONSES.internal(request, error.message)
  }
}
