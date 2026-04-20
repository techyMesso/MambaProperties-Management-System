import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { UUID_REGEX } from '@/app/api/admin/_lib/tableColumns'
import { toText, tryAuditLog } from '@/libs/admin/transforms'

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
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const normalizeInteger = value => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isInteger(parsed) ? parsed : null
}

const MAX_PLAN_AMOUNT = 10_000_000
const MAX_DURATION_DAYS = 3650

const resolvePlanTarget = async (supabase, planId) => {
  if (UUID_REGEX.test(planId)) {
    const byId = await supabase.from('subscription_plans').select('*').eq('id', planId).maybeSingle()

    if (byId.error) {
      throw new Error(byId.error.message || 'Unable to load plan.')
    }

    if (byId.data) {
      return { row: byId.data, match: { id: planId } }
    }
  }

  const byCode = await supabase.from('subscription_plans').select('*').eq('plan_code', planId).maybeSingle()

  if (byCode.error) {
    throw new Error(byCode.error.message || 'Unable to load plan.')
  }

  if (byCode.data) {
    return { row: byCode.data, match: { plan_code: planId } }
  }

  return { row: null, match: null }
}

export async function PUT(request, { params }) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  const planId = toText((await params).planId)

  if (!planId) {
    return API_RESPONSES.badRequest(request, 'Plan id is required.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  let target

  try {
    target = await resolvePlanTarget(adminSupabase, planId)
  } catch (error) {
    return API_RESPONSES.badRequest(request, error.message || 'Unable to load plan.')
  }

  if (!target?.row || !target?.match) {
    return API_RESPONSES.notFound(request, 'Subscription plan not found.')
  }

  const payload = {}
  const note = toText(body?.note)
  const planCode = toText(body?.planCode).toLowerCase()
  const planName = toText(body?.planName)
  const description = toText(body?.description)
  const audience = toText(body?.audience)
  const featureKey = toText(body?.featureKey).toLowerCase()
  const billingCycle = toText(body?.billingCycle)
  const amount = normalizeAmount(body?.amount)
  const currency = toText(body?.currency)
  const durationDays = normalizeInteger(body?.durationDays)
  const sortOrder = normalizeInteger(body?.sortOrder)

  if (planCode) {
    payload.plan_code = planCode
  }

  if (planName) {
    payload.plan_name = planName
  }

  if (description || body?.description === '') {
    payload.description = description || null
  }

  if (audience) {
    payload.audience = audience
  }

  if (featureKey) {
    payload.feature_key = featureKey
  }

  if (billingCycle) {
    payload.billing_cycle = billingCycle
  }

  if (amount !== null) {
    if (amount <= 0 || amount > MAX_PLAN_AMOUNT) {
      return API_RESPONSES.badRequest(request, `amount must be greater than 0 and not exceed ${MAX_PLAN_AMOUNT}.`)
    }

    payload.amount = amount
  }

  if (currency) {
    payload.currency = currency
  }

  if (durationDays !== null) {
    if (durationDays <= 0 || durationDays > MAX_DURATION_DAYS) {
      return API_RESPONSES.badRequest(request, `durationDays must be between 1 and ${MAX_DURATION_DAYS}.`)
    }

    payload.duration_days = durationDays
  }

  if (sortOrder !== null) {
    payload.sort_order = sortOrder
  }

  if (body?.features !== undefined) {
    payload.features = normalizeFeatures(body?.features)
  }

  if (typeof body?.active === 'boolean') {
    payload.active = body.active
  }

  if (!Object.keys(payload).length) {
    return API_RESPONSES.badRequest(request, 'No editable fields were provided.')
  }

  const updateResult = await safeQuery(
    adminSupabase
      .from('subscription_plans')
      .update(payload)
      .match(target.match)
      .select(
        'id,plan_code,plan_name,description,audience,feature_key,billing_cycle,amount,currency,duration_days,features,sort_order,active,updated_at,created_at'
      )
      .maybeSingle()
  )

  if (updateResult.error) {
    return API_RESPONSES.badRequest(request, updateResult.error.message || 'Unable to update subscription plan.')
  }

  await tryAuditLog({
    supabase: adminSupabase,
    user,
    entity: 'Subscription Plan',
    action: 'Subscription Plan Updated',
    status: 'completed',
    note
  })

  return API_RESPONSES.ok(request, {
    plan: updateResult.data
  })
}
