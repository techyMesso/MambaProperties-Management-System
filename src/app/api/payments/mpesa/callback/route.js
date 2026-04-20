import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { queueUserNotifications } from '@/libs/notifications/queue'
import {
  logManagementModuleIncome,
  logMarketplaceListingIncome,
  logPlatformIncome,
  logTenantSubscriptionIncome
} from '@/libs/payments/logIncome'
import { getMpesaCallbackConfig, parseMpesaTransactionDate, verifyMpesaCallbackSignature } from '@/libs/payments/mpesa'
import { enforceRouteRateLimit } from '@/libs/security/rateLimit'
import { createAdminClient } from '@/libs/supabase/admin'

const readMetadataValue = (items, key) => {
  if (!Array.isArray(items)) {
    return null
  }

  const matched = items.find(item => String(item?.Name || '').toLowerCase() === key.toLowerCase())

  return matched?.Value ?? null
}

const toNumberOrNull = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const redactPhone = value => {
  const normalized = String(value || '').trim()

  if (!normalized) {
    return null
  }

  if (normalized.length <= 4) {
    return '*'.repeat(normalized.length)
  }

  return `${'*'.repeat(normalized.length - 4)}${normalized.slice(-4)}`
}

const toSafeEventPayload = ({ checkoutRequestId, resultCode, resultDescription, receiptNumber, providerPhone, transactionDateRaw }) => ({
  checkoutRequestId,
  resultCode,
  resultDescription,
  receiptNumber,
  phoneNumberMasked: redactPhone(providerPhone),
  transactionDate: transactionDateRaw
})

const getRequestIp = request => {
  const candidates = [
    request.headers.get('x-forwarded-for'),
    request.headers.get('x-real-ip'),
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-client-ip')
  ]

  const raw = String(candidates.find(value => String(value || '').trim()) || '').trim()

  if (!raw) {
    return ''
  }

  const first = raw.split(',')[0]?.trim() || ''

  return first.split(':')[0]?.trim() || ''
}

const isAllowedIp = (allowedIps, request) => {
  if (!Array.isArray(allowedIps) || !allowedIps.length) {
    return true
  }

  const ip = getRequestIp(request)

  if (!ip) {
    return false
  }

  return allowedIps.includes(ip)
}

const isTimestampFresh = (timestampIso, maxAgeSeconds) => {
  if (!timestampIso) {
    return false
  }

  const maxAge = Number(maxAgeSeconds)

  if (!Number.isFinite(maxAge) || maxAge <= 0) {
    return true
  }

  const parsed = new Date(timestampIso).getTime()

  if (Number.isNaN(parsed)) {
    return false
  }

  const ageSeconds = Math.abs(Date.now() - parsed) / 1000

  return ageSeconds <= maxAge
}

const resolveTenantSubscription = async (adminSupabase, checkoutRequestId) => {
  const result = await safeQuery(
    adminSupabase
      .from('tenant_subscriptions')
      .select('id,user_id,subscription_type,status,payment_status,amount_due,amount_paid,expires_at,payment_reference,started_at')
      .eq('payment_reference', checkoutRequestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  )

  return result
}

const amountsMatch = (expectedAmount, callbackAmount) => {
  const expected = Number(expectedAmount)
  const actual = Number(callbackAmount)

  if (!Number.isFinite(expected) || !Number.isFinite(actual)) {
    return false
  }

  return Math.abs(expected - actual) < 0.01
}

const logCallbackEvent = async ({ adminSupabase, ownerId = null, paymentId = null, checkoutRequestId, status, payload = {} }) =>
  safeQuery(
    adminSupabase.from('payment_provider_events').insert({
      owner_id: ownerId,
      payment_id: paymentId,
      provider: 'mpesa',
      event_type: 'stk_callback',
      checkout_request_id: checkoutRequestId,
      status,
      payload
    })
  )

const processTenantSubscriptionCallback = async ({
  adminSupabase,
  tenantSubscription,
  checkoutRequestId,
  nextStatus,
  receiptNumber,
  callbackAmount,
  paidAt
}) => {
  const currentStatus = String(tenantSubscription?.status || '').trim().toLowerCase()
  const currentPaymentStatus = String(tenantSubscription?.payment_status || '').trim().toLowerCase()

  if (nextStatus === 'paid' && ['active', 'trial'].includes(currentStatus) && currentPaymentStatus === 'paid') {
    return {
      alreadyProcessed: true,
      subscriptionId: tenantSubscription.id,
      status: currentStatus
    }
  }

  const updatePayload =
    nextStatus === 'paid'
      ? {
          status: 'active',
          payment_status: 'paid',
          amount_paid: tenantSubscription.amount_due ?? callbackAmount ?? 0,
          payment_reference: receiptNumber || checkoutRequestId,
          payment_method: 'mpesa',
          started_at: tenantSubscription.started_at || paidAt || new Date().toISOString()
        }
      : {
          status: 'pending',
          payment_status: 'unpaid',
          payment_reference: null,
          payment_method: 'mpesa'
        }

  const updateResult = await safeQuery(
    adminSupabase
      .from('tenant_subscriptions')
      .update(updatePayload)
      .eq('id', tenantSubscription.id)
      .eq('payment_reference', checkoutRequestId)
      .select('id,user_id,subscription_type,status,payment_status,amount_due,amount_paid')
      .maybeSingle()
  )

  if (updateResult.error) {
    throw new Error(updateResult.error.message || 'Unable to update tenant subscription.')
  }

  if (!updateResult.data?.id) {
    return {
      alreadyProcessed: true,
      subscriptionId: tenantSubscription.id,
      status: currentStatus || 'pending'
    }
  }

  if (nextStatus === 'paid') {
    await logTenantSubscriptionIncome(adminSupabase, updateResult.data, updateResult.data.amount_due)
  }

  await safeQuery(
    adminSupabase.from('payment_provider_events').insert({
      owner_id: tenantSubscription.user_id,
      provider: 'mpesa',
      event_type: 'stk_callback',
      checkout_request_id: checkoutRequestId,
      status: nextStatus,
      payload: {
        checkoutRequestId,
        relatedType: 'tenant_subscription',
        relatedId: tenantSubscription.id,
        receiptNumber,
        callbackAmount,
        paidAt
      }
    })
  )

  return {
    alreadyProcessed: false,
    subscriptionId: updateResult.data.id,
    status: updateResult.data.status
  }
}

const activateLandlordFeatureAccess = async ({ adminSupabase, paymentRow, nextStatus, callbackAmount, receiptNumber, checkoutRequestId, paidAt }) => {
  const metadata = paymentRow?.metadata || {}
  const paymentKind = String(metadata?.payment_kind || '').trim().toLowerCase()
  const featureAccessIds = Array.isArray(metadata?.feature_access_ids) ? metadata.feature_access_ids.filter(Boolean) : []
  const features = Array.isArray(metadata?.features) ? metadata.features.map(item => String(item || '').trim()).filter(Boolean) : []
  const planCode = String(metadata?.subscription_plan_code || '').trim()

  if (paymentKind !== 'landlord_plan_subscription' || !featureAccessIds.length) {
    return
  }

  if (nextStatus !== 'paid') {
    await safeQuery(
      adminSupabase
        .from('landlord_feature_access')
        .update({
          is_active: false,
          notes: JSON.stringify({
            planCode,
            status: 'payment_failed',
            checkoutRequestId,
            receiptNumber
          })
        })
        .in('id', featureAccessIds)
        .eq('landlord_id', paymentRow.owner_id)
    )

    return
  }

  const paidTimestamp = paidAt || new Date().toISOString()

  await safeQuery(
    adminSupabase
      .from('landlord_feature_access')
      .update({
        is_active: true,
        granted_at: paidTimestamp,
        paid_until: null,
        notes: JSON.stringify({
          planCode,
          status: 'paid',
          checkoutRequestId,
          receiptNumber,
          paidAt: paidTimestamp
        })
      })
      .in('id', featureAccessIds)
      .eq('landlord_id', paymentRow.owner_id)
  )

  if (planCode === 'landlord_full_access' || features.length > 1) {
    await logPlatformIncome(adminSupabase, {
      incomeType: 'landlord_premium_features',
      relatedUserId: paymentRow.owner_id,
      relatedPaymentId: paymentRow.id,
      amount: callbackAmount ?? paymentRow.amount,
      status: 'confirmed',
      metadata: {
        planCode,
        features
      }
    })

    return
  }

  if (features.includes('marketplace_listing')) {
    await logMarketplaceListingIncome(adminSupabase, paymentRow.owner_id, callbackAmount ?? paymentRow.amount, {
      planCode,
      paymentId: paymentRow.id
    })
  }

  if (features.includes('management_module')) {
    await logManagementModuleIncome(adminSupabase, paymentRow.owner_id, callbackAmount ?? paymentRow.amount, {
      planCode,
      paymentId: paymentRow.id
    })
  }
}

export async function POST(request) {
  const rateLimitError = await enforceRouteRateLimit(request, {
    scope: 'payments-mpesa-callback',
    limit: 240,
    windowMs: 60_000,
    message: 'Callback rate limit exceeded.'
  })

  if (rateLimitError) {
    return rateLimitError
  }

  const adminSupabase = createAdminClient()

  if (!adminSupabase) {
    return API_RESPONSES.unavailable(request, 'SUPABASE_SERVICE_ROLE_KEY is required for M-Pesa callback processing.')
  }

  const callbackConfig = getMpesaCallbackConfig()
  const signatureHeader = callbackConfig.signatureHeader || 'x-mpesa-signature'
  const providedSignature = String(request.headers.get(signatureHeader) || '').trim()

  if (!callbackConfig.allowUnsignedCallbacks && (!callbackConfig.callbackSecrets || !callbackConfig.callbackSecrets.length)) {
    return API_RESPONSES.unavailable(request, 'M-Pesa callback secret is not configured.')
  }

  if (!isAllowedIp(callbackConfig.allowedIps, request)) {
    return API_RESPONSES.forbidden(request, 'Callback IP is not allowlisted.')
  }

  let rawBody = ''
  let body

  try {
    rawBody = await request.text()
    body = JSON.parse(rawBody)
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid callback payload.')
  }

  if (callbackConfig.callbackSecrets && callbackConfig.callbackSecrets.length) {
    const verification = verifyMpesaCallbackSignature({
      rawPayload: rawBody,
      providedSignature,
      callbackSecrets: callbackConfig.callbackSecrets
    })

    if (!verification.ok) {
      return API_RESPONSES.unauthorized(request, verification.reason || 'Invalid callback signature.')
    }
  } else if (!callbackConfig.allowUnsignedCallbacks) {
    return API_RESPONSES.unauthorized(request, 'Unsigned callback rejected.')
  }

  const callback = body?.Body?.stkCallback
  const checkoutRequestId = String(callback?.CheckoutRequestID || '').trim()

  if (!checkoutRequestId) {
    return API_RESPONSES.badRequest(request, 'Missing CheckoutRequestID in callback.')
  }

  const resultCode = Number(callback?.ResultCode ?? -1)
  const resultDescription = String(callback?.ResultDesc || '').trim() || 'No description'
  const metadataItems = callback?.CallbackMetadata?.Item || []
  const callbackAmount = toNumberOrNull(readMetadataValue(metadataItems, 'Amount'))
  const receiptNumber = String(readMetadataValue(metadataItems, 'MpesaReceiptNumber') || '').trim() || null
  const providerPhone = String(readMetadataValue(metadataItems, 'PhoneNumber') || '').trim() || null
  const transactionDateRaw = readMetadataValue(metadataItems, 'TransactionDate')
  const paidAt = parseMpesaTransactionDate(transactionDateRaw)
  const requireTimestamp = resultCode === 0 && !callbackConfig.allowMissingTimestamp

  if (!paidAt && requireTimestamp) {
    return API_RESPONSES.badRequest(request, 'Missing or invalid M-Pesa transaction timestamp.')
  }

  if (paidAt && !isTimestampFresh(paidAt, callbackConfig.maxAgeSeconds)) {
    return API_RESPONSES.unauthorized(request, 'Callback timestamp is outside the allowed window.')
  }

  const eventPayload = toSafeEventPayload({
    checkoutRequestId,
    resultCode,
    resultDescription,
    receiptNumber,
    providerPhone,
    transactionDateRaw
  })

  const nextStatus = resultCode === 0 ? 'paid' : 'failed'

  const lookupResult = await safeQuery(
    adminSupabase.from('payments').select('id, owner_id, amount, status, metadata').eq('channel_reference', checkoutRequestId).maybeSingle()
  )

  if (lookupResult.error) {
    return API_RESPONSES.badRequest(request, lookupResult.error.message)
  }

  const paymentRow = lookupResult.data
  let tenantSubscription = null

  if (!paymentRow?.id) {
    const tenantSubscriptionResult = await resolveTenantSubscription(adminSupabase, checkoutRequestId)

    if (tenantSubscriptionResult.error) {
      return API_RESPONSES.badRequest(request, tenantSubscriptionResult.error.message)
    }

    tenantSubscription = tenantSubscriptionResult.data
  }

  if (!paymentRow?.id && !tenantSubscription?.id) {
    await safeQuery(
      adminSupabase.from('payment_provider_events').insert({
        provider: 'mpesa',
        event_type: 'stk_callback',
        checkout_request_id: checkoutRequestId,
        merchant_request_id: String(callback?.MerchantRequestID || '').trim() || null,
        status: 'unmatched',
        payload: eventPayload
      })
    )

    return API_RESPONSES.ok(
      request,
      {
        warning: 'No matching payment record for callback.',
        checkoutRequestId
      }
    )
  }

  if (!paymentRow?.id && tenantSubscription?.id) {
    if (nextStatus === 'paid') {
      if (callbackAmount === null) {
        await logCallbackEvent({
          adminSupabase,
          ownerId: tenantSubscription.user_id,
          checkoutRequestId,
          status: 'amount_missing',
          payload: {
            ...eventPayload,
            relatedType: 'tenant_subscription',
            relatedId: tenantSubscription.id
          }
        })

        return API_RESPONSES.badRequest(request, 'Paid callback is missing the transaction amount.')
      }

      if (!amountsMatch(tenantSubscription.amount_due, callbackAmount)) {
        await logCallbackEvent({
          adminSupabase,
          ownerId: tenantSubscription.user_id,
          checkoutRequestId,
          status: 'amount_mismatch',
          payload: {
            ...eventPayload,
            relatedType: 'tenant_subscription',
            relatedId: tenantSubscription.id,
            expectedAmount: tenantSubscription.amount_due,
            callbackAmount
          }
        })

        return API_RESPONSES.badRequest(request, 'Callback amount does not match the tenant subscription amount due.')
      }
    }

    try {
      const processed = await processTenantSubscriptionCallback({
        adminSupabase,
        tenantSubscription,
        checkoutRequestId,
        nextStatus,
        receiptNumber,
        callbackAmount,
        paidAt
      })

      return API_RESPONSES.ok(request, {
        subscriptionId: processed.subscriptionId,
        checkoutRequestId,
        status: processed.status,
        alreadyProcessed: processed.alreadyProcessed || false
      })
    } catch (error) {
      return API_RESPONSES.badRequest(request, error.message || 'Unable to update tenant subscription.')
    }
  }

  const currentStatus = String(paymentRow.status || '').trim().toLowerCase()
  const isTerminalStatus = currentStatus === 'paid' || currentStatus === 'failed'
  const isAlreadyProcessed = isTerminalStatus && currentStatus === nextStatus

  if (isAlreadyProcessed) {
    return API_RESPONSES.ok(request, {
      paymentId: paymentRow.id,
      checkoutRequestId,
      status: currentStatus,
      alreadyProcessed: true
    })
  }

  if (isTerminalStatus && currentStatus !== nextStatus) {
    return API_RESPONSES.conflict(
      request,
      'Payment was already finalized. Callback ignored.',
      {
        paymentId: paymentRow.id,
        checkoutRequestId,
        status: currentStatus
      }
    )
  }

  const mergedMetadata = {
    ...(paymentRow.metadata || {}),
    provider: 'mpesa',
    callback: {
      checkoutRequestId,
      resultCode,
      resultDescription,
      callbackAmount,
      receiptNumber,
      phoneNumberMasked: redactPhone(providerPhone),
      transactionDate: transactionDateRaw
    }
  }

  if (nextStatus === 'paid') {
    if (callbackAmount === null) {
      await logCallbackEvent({
        adminSupabase,
        ownerId: paymentRow.owner_id,
        paymentId: paymentRow.id,
        checkoutRequestId,
        status: 'amount_missing',
        payload: eventPayload
      })

      return API_RESPONSES.badRequest(request, 'Paid callback is missing the transaction amount.')
    }

    if (!amountsMatch(paymentRow.amount, callbackAmount)) {
      await logCallbackEvent({
        adminSupabase,
        ownerId: paymentRow.owner_id,
        paymentId: paymentRow.id,
        checkoutRequestId,
        status: 'amount_mismatch',
        payload: {
          ...eventPayload,
          expectedAmount: paymentRow.amount,
          callbackAmount
        }
      })

      return API_RESPONSES.badRequest(request, 'Callback amount does not match the recorded payment amount.')
    }
  }

  const updatePayload = {
    status: nextStatus,
    transaction_ref: receiptNumber,
    amount: paymentRow.amount,
    metadata: mergedMetadata
  }

  if (paidAt) {
    updatePayload.paid_at = paidAt
  }

  const updateResult = await safeQuery(
    adminSupabase.from('payments').update(updatePayload).eq('id', paymentRow.id).eq('status', 'pending').select('id').maybeSingle()
  )

  if (updateResult.error) {
    return API_RESPONSES.badRequest(request, updateResult.error.message)
  }

  if (!updateResult.data?.id) {
    return API_RESPONSES.ok(request, {
      paymentId: paymentRow.id,
      checkoutRequestId,
      status: currentStatus || 'pending',
      warning: 'Callback ignored because payment is no longer pending.'
    })
  }

  await safeQuery(
    adminSupabase.from('payment_provider_events').insert({
      owner_id: paymentRow.owner_id,
      payment_id: paymentRow.id,
      provider: 'mpesa',
      event_type: 'stk_callback',
      checkout_request_id: checkoutRequestId,
      merchant_request_id: String(callback?.MerchantRequestID || '').trim() || null,
      status: nextStatus,
      payload: eventPayload
    })
  )

  await activateLandlordFeatureAccess({
    adminSupabase,
    paymentRow: {
      ...paymentRow,
      id: paymentRow.id
    },
    nextStatus,
    callbackAmount,
    receiptNumber,
    checkoutRequestId,
    paidAt
  })

  const planCode = String(paymentRow?.metadata?.subscription_plan_code || '').trim() || 'landlord plan'

  const paymentMessage =
    nextStatus === 'paid'
      ? `Your ${planCode} payment has been confirmed. Subscription access is now active for your account.`
      : `Your ${planCode} payment did not complete successfully. Please retry from the pricing page.`

  await queueUserNotifications({
    supabase: adminSupabase,
    ownerId: paymentRow.owner_id,
    recipientUserId: paymentRow.owner_id,
    subject: 'Mamba Properties Payment Update',
    message: paymentMessage,
    channels: ['sms', 'email']
  })

  return API_RESPONSES.ok(request, {
    paymentId: paymentRow.id,
    checkoutRequestId,
    status: nextStatus
  })
}
