import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { toText, tryAuditLog } from '@/libs/admin/transforms'
import { normalizeSubscriptionPlanRecord } from '@/libs/pricing/subscriptionPlans'

const normalizeFeatures = value => {
  if (Array.isArray(value)) {
    return value.map(item => toText(item)).filter(Boolean)
  }

  return String(value || '')
    .split('\n')
    .flatMap(item => item.split(','))
    .map(item => toText(item))
    .filter(Boolean)
}

const normalizeAmount = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const MAX_PLAN_AMOUNT = 10_000_000
const MAX_DURATION_DAYS = 3650

const normalizeInteger = value => {
  const parsed = Number(value)

  return Number.isInteger(parsed) ? parsed : null
}

export async function GET(request) {
  const context = await requireAdminContext(request)

  if (context.error) {
    return context.error
  }

  const plansResult = await safeQuery(
    context.adminSupabase
      .from('subscription_plans')
      .select(
        'id,plan_code,plan_name,description,audience,feature_key,billing_cycle,amount,currency,duration_days,features,sort_order,active,updated_at,created_at'
      )
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
  )

  if (plansResult.error) {
    return API_RESPONSES.badRequest(request, plansResult.error.message || 'Unable to load subscription plans.')
  }

  return API_RESPONSES.ok(request, { plans: (plansResult.data || []).map(normalizeSubscriptionPlanRecord) })
}

export async function POST(request) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const planCode = toText(body?.planCode).toLowerCase()
  const planName = toText(body?.planName)
  const description = toText(body?.description)
  const audience = toText(body?.audience || 'tenant')
  const featureKey = toText(body?.featureKey).toLowerCase()
  const billingCycle = toText(body?.billingCycle || 'monthly')
  const amount = normalizeAmount(body?.amount)
  const currency = toText(body?.currency || 'KES') || 'KES'
  const durationDays = normalizeInteger(body?.durationDays)
  const sortOrder = normalizeInteger(body?.sortOrder) ?? 0
  const active = body?.active !== false
  const features = normalizeFeatures(body?.features)
  const note = toText(body?.note)

  if (!planCode || !planName || !featureKey || amount === null || durationDays === null) {
    return API_RESPONSES.badRequest(
      request,
      'planCode, planName, featureKey, amount, and durationDays are required.'
    )
  }

  if (amount <= 0 || amount > MAX_PLAN_AMOUNT) {
    return API_RESPONSES.badRequest(request, `amount must be greater than 0 and not exceed ${MAX_PLAN_AMOUNT}.`)
  }

  if (durationDays <= 0 || durationDays > MAX_DURATION_DAYS) {
    return API_RESPONSES.badRequest(request, `durationDays must be between 1 and ${MAX_DURATION_DAYS}.`)
  }

  const insertResult = await safeQuery(
    adminSupabase
      .from('subscription_plans')
      .insert({
        plan_code: planCode,
        plan_name: planName,
        description: description || null,
        audience,
        feature_key: featureKey,
        billing_cycle: billingCycle,
        amount,
        currency,
        duration_days: durationDays,
        features,
        sort_order: sortOrder,
        active,
        metadata: {}
      })
      .select(
        'id,plan_code,plan_name,description,audience,feature_key,billing_cycle,amount,currency,duration_days,features,sort_order,active,updated_at,created_at'
      )
      .maybeSingle()
  )

  if (insertResult.error) {
    return API_RESPONSES.badRequest(request, insertResult.error.message || 'Unable to create subscription plan.')
  }

  await tryAuditLog({
    supabase: adminSupabase,
    user,
    entity: 'Subscription Plan',
    action: 'Subscription Plan Created',
    status: 'completed',
    note
  })

  return API_RESPONSES.created(request, {
    plan: insertResult.data
  })
}
