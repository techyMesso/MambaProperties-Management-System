import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { UUID_REGEX, firstColumn, firstValue, listTableColumns } from '@/app/api/admin/_lib/tableColumns'
import { toText, normalizeDecision, normalizeStatus, tryAuditLog } from '@/libs/admin/transforms'

const TABLE_NAME = 'landlord_subscriptions'

const DECISION_TO_STATUS = {
  approve: 'active',
  approved: 'active',
  reject: 'rejected',
  rejected: 'rejected'
}

const PLAN_COLUMNS = ['plan_name', 'plan_code', 'plan', 'subscription_plan', 'tier']
const REQUEST_COLUMNS = ['requested_plan', 'pending_plan', 'next_plan', 'plan_change_request']
const STATUS_COLUMNS = ['status']
const ACTIVE_COLUMNS = ['active', 'is_active']
const REVIEW_STATUS_COLUMNS = ['approval_status', 'review_status', 'decision']
const REVIEW_NOTE_COLUMNS = ['review_note', 'decision_note', 'admin_note', 'notes']
const REVIEWED_AT_COLUMNS = ['reviewed_at', 'approved_at', 'decision_at']
const REVIEWED_BY_COLUMNS = ['reviewed_by', 'approved_by', 'reviewed_by_id']
const UPDATED_AT_COLUMNS = ['updated_at']
const START_DATE_COLUMNS = ['starts_at', 'start_date', 'billing_start']
const END_DATE_COLUMNS = ['ends_at', 'end_date', 'billing_end']

const resolveRouteParams = async params => (params ? await params : {})

const omitKeys = (payload, keys = []) =>
  Object.fromEntries(Object.entries(payload || {}).filter(([key]) => !keys.includes(key)))

const getTargetSubscription = async ({ supabase, columns, subscriptionId }) => {
  const hasIdColumn = columns.has('id')
  const hasSubscriptionIdColumn = columns.has('subscription_id')
  const isUuid = UUID_REGEX.test(subscriptionId)

  if (hasIdColumn && isUuid) {
    const byId = await supabase.from(TABLE_NAME).select('*').eq('id', subscriptionId).maybeSingle()

    if (byId.data) {
      return {
        row: byId.data,
        match: { id: subscriptionId }
      }
    }

    if (byId.error) {
      throw new Error(byId.error.message || 'Unable to load subscription.')
    }
  }

  if (hasSubscriptionIdColumn) {
    const bySubscriptionId = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('subscription_id', subscriptionId)
      .maybeSingle()

    if (bySubscriptionId.error) {
      throw new Error(bySubscriptionId.error.message || 'Unable to load subscription.')
    }

    if (bySubscriptionId.data) {
      return {
        row: bySubscriptionId.data,
        match: { subscription_id: subscriptionId }
      }
    }
  }

  if (hasIdColumn) {
    const byIdFallback = await supabase.from(TABLE_NAME).select('*').eq('id', subscriptionId).maybeSingle()

    if (byIdFallback.error) {
      throw new Error(byIdFallback.error.message || 'Unable to load subscription.')
    }

    if (byIdFallback.data) {
      return {
        row: byIdFallback.data,
        match: { id: subscriptionId }
      }
    }
  }

  return {
    row: null,
    match: null
  }
}

export async function POST(request, { params }) {
  const context = await requireAdminContext(request, { enforceMutationOrigin: true })

  if (context.error) {
    return context.error
  }

  const { adminSupabase, user } = context
  const routeParams = await resolveRouteParams(params)
  const subscriptionId = toText(routeParams?.subscriptionId)

  if (!subscriptionId) {
    return API_RESPONSES.badRequest(request, 'Subscription id is required.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    return API_RESPONSES.badRequest(request, 'Invalid JSON payload.')
  }

  const decision = normalizeDecision(body?.decision)
  const requestedStatus = normalizeStatus(body?.status)
  const decisionStatus = DECISION_TO_STATUS[decision]
  const nextPlanInput = toText(body?.nextPlan)
  const note = toText(body?.note)
  const startsAt = toText(body?.startsAt)
  const endsAt = toText(body?.endsAt)

  if (!decisionStatus) {
    return API_RESPONSES.badRequest(request, 'decision must be approve or reject.')
  }

  let columns

  try {
    columns = await listTableColumns(adminSupabase, TABLE_NAME)
  } catch (error) {
    return API_RESPONSES.badRequest(request, error.message || 'Unable to inspect subscription schema.')
  }

  let target
  let match

  try {
    const resolved = await getTargetSubscription({
      supabase: adminSupabase,
      columns,
      subscriptionId
    })

    target = resolved.row
    match = resolved.match
  } catch (error) {
    return API_RESPONSES.badRequest(request, error.message || 'Unable to load subscription.')
  }

  if (!target || !match) {
    return API_RESPONSES.notFound(request, 'Subscription not found.')
  }

  const payload = {}
  const nowIso = new Date().toISOString()

  const resolvedPlan =
    nextPlanInput || toText(firstValue(target, REQUEST_COLUMNS)) || toText(firstValue(target, PLAN_COLUMNS))

  const resolvedStatus = requestedStatus || decisionStatus
  const resolvedReviewDecision = decisionStatus === 'active' ? 'approved' : decisionStatus

  const statusColumn = firstColumn(columns, STATUS_COLUMNS)
  const activeColumn = firstColumn(columns, ACTIVE_COLUMNS)
  const reviewStatusColumn = firstColumn(columns, REVIEW_STATUS_COLUMNS)
  const reviewNoteColumn = firstColumn(columns, REVIEW_NOTE_COLUMNS)
  const reviewedAtColumn = firstColumn(columns, REVIEWED_AT_COLUMNS)
  const reviewedByColumn = firstColumn(columns, REVIEWED_BY_COLUMNS)
  const updatedAtColumn = firstColumn(columns, UPDATED_AT_COLUMNS)
  const startDateColumn = firstColumn(columns, START_DATE_COLUMNS)
  const endDateColumn = firstColumn(columns, END_DATE_COLUMNS)
  const shouldApplyYearlyPeriod = ['active', 'trial'].includes(resolvedStatus)
  const yearlyEndsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  const defaultStartsAt = startsAt || nowIso
  const defaultEndsAt = endsAt || yearlyEndsAt

  if (resolvedPlan) {
    PLAN_COLUMNS.forEach(column => {
      if (columns.has(column)) {
        payload[column] = resolvedPlan
      }
    })
  }

  if (statusColumn) {
    payload[statusColumn] = resolvedStatus
  }

  if (activeColumn) {
    payload[activeColumn] = !['rejected', 'inactive', 'cancelled', 'expired'].includes(resolvedStatus)
  }

  REQUEST_COLUMNS.forEach(column => {
    if (columns.has(column)) {
      payload[column] = null
    }
  })

  if (reviewStatusColumn) {
    payload[reviewStatusColumn] = resolvedReviewDecision
  }

  if (reviewNoteColumn && note) {
    payload[reviewNoteColumn] = note
  }

  if (reviewedAtColumn) {
    payload[reviewedAtColumn] = nowIso
  }

  if (reviewedByColumn) {
    payload[reviewedByColumn] = user.id
  }

  if (updatedAtColumn) {
    payload[updatedAtColumn] = nowIso
  }

  if (startDateColumn && (startsAt || shouldApplyYearlyPeriod)) {
    payload[startDateColumn] = startsAt || defaultStartsAt
  }

  if (endDateColumn && (endsAt || shouldApplyYearlyPeriod)) {
    payload[endDateColumn] = endsAt || defaultEndsAt
  }

  if (Object.keys(payload).length === 0) {
    return API_RESPONSES.badRequest(request, 'No writable fields were found for this subscription schema.')
  }

  const fallbackPayloads = [payload]
  const dateColumns = [startDateColumn, endDateColumn].filter(Boolean)
  const reviewColumns = [reviewStatusColumn, reviewNoteColumn, reviewedAtColumn, reviewedByColumn].filter(Boolean)

  if (dateColumns.length) {
    fallbackPayloads.push(omitKeys(payload, dateColumns))
  }

  if (reviewColumns.length) {
    fallbackPayloads.push(omitKeys(payload, reviewColumns))
  }

  if (dateColumns.length || reviewColumns.length) {
    fallbackPayloads.push(omitKeys(payload, [...dateColumns, ...reviewColumns]))
  }

  let updateResult = { data: null, error: null }

  for (const candidatePayload of fallbackPayloads) {
    if (!candidatePayload || Object.keys(candidatePayload).length === 0) {
      continue
    }

    updateResult = await safeQuery(
      adminSupabase.from(TABLE_NAME).update(candidatePayload).match(match).select('*').maybeSingle()
    )

    if (!updateResult.error && updateResult.data) {
      break
    }
  }

  if (updateResult.error) {
    return API_RESPONSES.badRequest(request, updateResult.error.message || 'Unable to update subscription.')
  }

  if (!updateResult.data) {
    return API_RESPONSES.notFound(request, 'Subscription not found or not writable.')
  }

  await tryAuditLog({
    supabase: adminSupabase,
    user,
    entity: `Subscription ${toText(updateResult.data.subscription_id || updateResult.data.id || '') || '-'}`,
    action: decision === 'reject' || decision === 'rejected' ? 'Plan Change Rejected' : 'Plan Change Approved',
    status: 'completed',
    note
  })

  return API_RESPONSES.ok(request, {
    id: toText(updateResult.data.id || target.id || ''),
    subscriptionId: toText(updateResult.data.subscription_id || target.subscription_id || subscriptionId),
    status: toText(updateResult.data.status || payload.status || resolvedStatus),
    plan: toText(firstValue(updateResult.data, PLAN_COLUMNS) || resolvedPlan),
    decision: resolvedReviewDecision
  })
}
