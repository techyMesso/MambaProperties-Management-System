import 'server-only'

import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import { safeQuery } from '@/libs/api/safeQuery'

const currencyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0
})

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CHANNEL_COLORS = ['primary', 'info', 'secondary', 'success', 'warning']

const normalizeStatus = value => String(value || '').trim().toLowerCase()

const toNumber = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

const sumBy = (rows, key) => (rows || []).reduce((sum, row) => sum + toNumber(row?.[key]), 0)

const formatKES = value => currencyFormatter.format(Math.max(0, toNumber(value)))

const normalizeChannel = value => {
  const normalized = String(value || '').trim()

  return normalized || 'Other'
}

const parseRowDate = row => {
  const value = row?.created_at

  if (!value) {
    return null
  }

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getCurrentAndPreviousMonthWindow = () => {
  const now = new Date()
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  return {
    now,
    startOfCurrentMonth,
    startOfPreviousMonth
  }
}

const getStartOfCurrentWeek = () => {
  const start = new Date()

  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - start.getDay())

  return start
}

const buildWeeklyOverview = paymentRows => {
  const currentWeekStart = getStartOfCurrentWeek()
  const currentWeekEnd = new Date(currentWeekStart)

  currentWeekEnd.setDate(currentWeekEnd.getDate() + 7)

  const previousWeekStart = new Date(currentWeekStart)

  previousWeekStart.setDate(previousWeekStart.getDate() - 7)

  const series = Array.from({ length: WEEKDAY_LABELS.length }, () => 0)
  let previousWeekTotal = 0

  paymentRows.forEach(row => {
    const amount = toNumber(row?.amount)
    const createdAt = parseRowDate(row)

    if (!createdAt || amount <= 0) {
      return
    }

    if (createdAt >= currentWeekStart && createdAt < currentWeekEnd) {
      series[createdAt.getDay()] += amount

      return
    }

    if (createdAt >= previousWeekStart && createdAt < currentWeekStart) {
      previousWeekTotal += amount
    }
  })

  const total = series.reduce((sum, amount) => sum + amount, 0)

  const performancePercentage =
    previousWeekTotal > 0 ? Math.round(((total - previousWeekTotal) / previousWeekTotal) * 100) : total > 0 ? 100 : 0

  return {
    categories: WEEKDAY_LABELS,
    series: series.map(value => Math.round(value)),
    total: Math.round(total),
    previousWeekTotal: Math.round(previousWeekTotal),
    performancePercentage
  }
}

const channelIconFromName = channel => {
  const value = String(channel || '').toLowerCase()

  if (value.includes('mpesa') || value.includes('m-pesa') || value.includes('mobile money')) {
    return 'ri-smartphone-line'
  }

  if (value.includes('bank') || value.includes('transfer')) {
    return 'ri-bank-line'
  }

  if (value.includes('cash')) {
    return 'ri-wallet-3-line'
  }

  if (value.includes('card') || value.includes('visa') || value.includes('mastercard')) {
    return 'ri-bank-card-line'
  }

  return 'ri-exchange-funds-line'
}

const buildTotalEarning = paymentRows => {
  const { startOfCurrentMonth, startOfPreviousMonth } = getCurrentAndPreviousMonthWindow()

  let currentMonthTotal = 0
  let previousMonthTotal = 0
  const byChannel = new Map()

  paymentRows.forEach(row => {
    const amount = toNumber(row?.amount)
    const createdAt = parseRowDate(row)

    if (!createdAt || amount <= 0) {
      return
    }

    if (createdAt >= startOfCurrentMonth) {
      currentMonthTotal += amount
    } else if (createdAt >= startOfPreviousMonth && createdAt < startOfCurrentMonth) {
      previousMonthTotal += amount
    }

    const channel = normalizeChannel(row?.channel)

    byChannel.set(channel, (byChannel.get(channel) || 0) + amount)
  })

  const totalCollected = currentMonthTotal

  const trendPercentage =
    previousMonthTotal > 0
      ? Math.round(((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100)
      : currentMonthTotal > 0
        ? 100
        : 0

  const sortedChannels = [...byChannel.entries()].sort((left, right) => right[1] - left[1])

  const channels = sortedChannels.slice(0, 3).map(([channel, amount], index) => ({
    key: `${channel}-${index}`,
    title: channel,
    subtitle: 'Collected rent inflow',
    amount: formatKES(amount),
    progress: totalCollected > 0 ? Math.max(1, Math.round((amount / totalCollected) * 100)) : 0,
    color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    icon: channelIconFromName(channel)
  }))

  return {
    totalCollected: formatKES(totalCollected),
    currentMonthTotal,
    previousMonthTotal,
    trendPercentage,
    trendDirection: trendPercentage >= 0 ? 'up' : 'down',
    comparisonLabel: `Compared to ${formatKES(previousMonthTotal)} last month`,
    channels
  }
}

const toMessage = error => {
  if (!error) {
    return ''
  }

  if (typeof error === 'string') {
    return error
  }

  return String(error?.message || error?.details || error?.hint || 'Unknown dashboard query error')
}

const withDefault = (metrics, error = null) => ({
  metrics,
  error: error || null
})

const summarizeErrors = errors => {
  const messages = errors.map(toMessage).filter(Boolean)

  return messages.length ? messages.join(' | ') : null
}

const runQuery = query => safeQuery(query, { fallbackData: [] })

const runSingle = async query => {
  try {
    const { data, error } = await query

    return {
      data: data || null,
      error: error || null
    }
  } catch (error) {
    return {
      data: null,
      error
    }
  }
}

const runCount = async query => {
  try {
    const { count, error } = await query

    return {
      count: Number.isFinite(count) ? count : 0,
      error: error || null
    }
  } catch (error) {
    return {
      count: 0,
      error
    }
  }
}

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isRpcUnavailableError = error => {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toUpperCase()

  return (
    code === 'PGRST202' ||
    message.includes('could not find the function') ||
    (message.includes('function') && message.includes('does not exist'))
  )
}

const parseRpcMetricsPayload = payload => {
  if (isPlainObject(payload)) {
    return payload
  }

  if (typeof payload !== 'string') {
    return null
  }

  try {
    const parsed = JSON.parse(payload)

    return isPlainObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

const tryLoadDashboardMetricsRpc = async (supabase, scope) => {
  const rpc = await runSingle(supabase.rpc('get_dashboard_metrics', { p_scope: scope }))

  if (rpc.error) {
    return {
      metrics: null,
      unavailable: isRpcUnavailableError(rpc.error)
    }
  }

  return {
    metrics: parseRpcMetricsPayload(rpc.data),
    unavailable: false
  }
}

const getOwnerScope = async providedScope => {
  const hasProvidedSupabase = Boolean(providedScope?.supabase)
  const providedUserId = providedScope?.userId || null
  const providedError = providedScope?.error || null

  if (hasProvidedSupabase) {
    return {
      supabase: providedScope.supabase,
      userId: providedUserId,
      error: providedError
    }
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return {
      supabase: null,
      userId: null,
      error: 'Supabase is not configured.'
    }
  }

  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    return {
      supabase,
      userId: user?.id || null,
      error: error || null
    }
  } catch (error) {
    return {
      supabase,
      userId: null,
      error
    }
  }
}

const DEFAULT_ADMIN_METRICS = {
  verifiedLandlords: 0,
  activeSubscriptions: 0,
  platformTransactions: formatKES(0),
  auditEvents24h: 0,
  totalPlots: 0,
  occupiedUnits: 0,
  actionQueues: [],
  alerts: [],
  analytics: {
    line: {
      totalLabel: 'KES 0',
      caption: 'Platform Transactions',
      series: [0, 0, 0, 0, 0, 0, 0],
      ranges: {
        '24h': { totalLabel: 'KES 0', caption: 'Transactions (24h)', series: [0, 0, 0, 0, 0, 0] },
        '7d': { totalLabel: 'KES 0', caption: 'Transactions (7d)', series: [0, 0, 0, 0, 0, 0, 0] },
        '30d': {
          totalLabel: 'KES 0',
          caption: 'Transactions (30d)',
          series: Array.from({ length: 30 }, () => 0)
        }
      }
    },
    sessions: {
      totalLabel: '0',
      caption: 'Audit Sessions',
      series: [0, 0, 0, 0, 0, 0, 0],
      ranges: {
        '24h': { totalLabel: '0', caption: 'Callbacks (24h)', series: [0, 0, 0, 0, 0, 0] },
        '7d': { totalLabel: '0', caption: 'Audit Sessions (7d)', series: [0, 0, 0, 0, 0, 0, 0] },
        '30d': {
          totalLabel: '0',
          caption: 'Audit Sessions (30d)',
          series: Array.from({ length: 30 }, () => 0)
        }
      }
    }
  }
}

const DEFAULT_LANDLORD_METRICS = {
  totalPlots: 0,
  totalUnits: 0,
  occupiedUnits: 0,
  vacantUnits: 0,
  occupancyRate: '0%',
  rentCollected: formatKES(0),
  pendingInvoices: 0,
  arrearsTenants: 0,
  openMaintenance: 0,
  analytics: {
    weeklyOverview: {
      categories: WEEKDAY_LABELS,
      series: Array.from({ length: WEEKDAY_LABELS.length }, () => 0),
      total: 0,
      previousWeekTotal: 0,
      performancePercentage: 0
    },
    totalEarning: {
      totalCollected: formatKES(0),
      trendPercentage: 0,
      trendDirection: 'up',
      comparisonLabel: `Compared to ${formatKES(0)} last month`,
      channels: []
    }
  }
}

const DEFAULT_AGENT_METRICS = {
  activeListings: 0,
  viewingsThisWeek: 0,
  pendingTenancies: 0,
  openTickets: 0,
  unreadOrPendingMessages: 0
}

const DEFAULT_TENANT_METRICS = {
  rentBalance: formatKES(0),
  paidThisMonth: formatKES(0),
  paymentStatus: 'No invoices',
  openRequests: 0,
  relocationUnits: 0
}

const formatCompactKES = value => {
  const amount = Math.max(0, toNumber(value))

  if (amount === 0) {
    return 'KES 0'
  }

  const compact = new Intl.NumberFormat('en-KE', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: amount >= 1000 ? 1 : 0
  }).format(amount)

  return `KES ${compact}`
}

const buildRecentDateKeys = days => {
  const keys = []
  const now = Date.now()

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * 24 * 60 * 60 * 1000)

    keys.push(date.toISOString().slice(0, 10))
  }

  return keys
}

const buildSeriesByDay = ({ rows, dateField, days, valueFn }) => {
  const dayKeys = buildRecentDateKeys(days)

  const totals = new Map(dayKeys.map(key => [key, 0]))

  ;(rows || []).forEach(row => {
    const dayKey = String(row?.[dateField] || '').slice(0, 10)

    if (!totals.has(dayKey)) {
      return
    }

    totals.set(dayKey, totals.get(dayKey) + toNumber(valueFn(row)))
  })

  return dayKeys.map(key => Math.round(totals.get(key) || 0))
}

const buildSeriesByRecentHours = ({ rows, dateField, hours = 24, bucketHours = 4, valueFn }) => {
  const bucketMs = bucketHours * 60 * 60 * 1000
  const horizonMs = hours * 60 * 60 * 1000
  const bucketCount = Math.max(1, Math.ceil(hours / bucketHours))
  const totals = Array.from({ length: bucketCount }, () => 0)

  const nowMs = Date.now()

  ;(rows || []).forEach(row => {
    const value = row?.[dateField]
    const parsed = value ? new Date(value) : null

    if (!parsed || Number.isNaN(parsed.getTime())) {
      return
    }

    const ageMs = nowMs - parsed.getTime()

    if (ageMs < 0 || ageMs >= horizonMs) {
      return
    }

    const reverseIndex = Math.floor(ageMs / bucketMs)
    const index = bucketCount - 1 - reverseIndex

    if (index < 0 || index >= bucketCount) {
      return
    }

    totals[index] += toNumber(valueFn(row))
  })

  return totals.map(value => Math.round(value))
}

const sumSeries = series => (series || []).reduce((sum, value) => sum + toNumber(value), 0)

const buildAdminAnalytics = ({ paymentRows, auditRows }) => {
  const transactions24h = buildSeriesByRecentHours({
    rows: paymentRows,
    dateField: 'created_at',
    hours: 24,
    bucketHours: 4,
    valueFn: row => row?.amount
  })

  const transactions7d = buildSeriesByDay({
    rows: paymentRows,
    dateField: 'created_at',
    days: 7,
    valueFn: row => row?.amount
  })

  const transactions30d = buildSeriesByDay({
    rows: paymentRows,
    dateField: 'created_at',
    days: 30,
    valueFn: row => row?.amount
  })

  const sessions24h = buildSeriesByRecentHours({
    rows: auditRows,
    dateField: 'event_time',
    hours: 24,
    bucketHours: 4,
    valueFn: () => 1
  })

  const sessions7d = buildSeriesByDay({
    rows: auditRows,
    dateField: 'event_time',
    days: 7,
    valueFn: () => 1
  })

  const sessions30d = buildSeriesByDay({
    rows: auditRows,
    dateField: 'event_time',
    days: 30,
    valueFn: () => 1
  })

  const lineRanges = {
    '24h': {
      totalLabel: formatCompactKES(sumSeries(transactions24h)),
      caption: 'Transactions (24h)',
      series: transactions24h
    },
    '7d': {
      totalLabel: formatCompactKES(sumSeries(transactions7d)),
      caption: 'Transactions (7d)',
      series: transactions7d
    },
    '30d': {
      totalLabel: formatCompactKES(sumSeries(transactions30d)),
      caption: 'Transactions (30d)',
      series: transactions30d
    }
  }

  const sessionRanges = {
    '24h': {
      totalLabel: new Intl.NumberFormat('en-KE').format(sumSeries(sessions24h)),
      caption: 'Callbacks (24h)',
      series: sessions24h
    },
    '7d': {
      totalLabel: new Intl.NumberFormat('en-KE').format(sumSeries(sessions7d)),
      caption: 'Audit Sessions (7d)',
      series: sessions7d
    },
    '30d': {
      totalLabel: new Intl.NumberFormat('en-KE').format(sumSeries(sessions30d)),
      caption: 'Audit Sessions (30d)',
      series: sessions30d
    }
  }

  return {
    line: {
      ...lineRanges['7d'],
      ranges: lineRanges
    },
    sessions: {
      ...sessionRanges['7d'],
      ranges: sessionRanges
    }
  }
}

const isMissingRelationError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('relation') && message.includes('does not exist')
}

const buildAdminActionQueues = ({ pendingRoleApprovals, pendingAuditActions, pendingProofReviews, failedCallbacks24h }) => [
  {
    key: 'role-approvals',
    label: 'Role Approvals',
    count: pendingRoleApprovals,
    hint: 'Requested role changes waiting review',
    href: '/user-management?requestedRole=pending',
    severity: pendingRoleApprovals > 0 ? 'warning' : 'success'
  },
  {
    key: 'compliance-queue',
    label: 'Compliance Queue',
    count: pendingAuditActions,
    hint: 'Audit actions pending or blocked',
    href: '/admin?status=pending',
    severity: pendingAuditActions > 0 ? 'warning' : 'success'
  },
  {
    key: 'proof-reviews',
    label: 'Tenant Proof Reviews',
    count: pendingProofReviews,
    hint: 'Uploaded payment proofs awaiting verification',
    href: '/documents?status=pending%20review',
    severity: pendingProofReviews > 0 ? 'warning' : 'success'
  },
  {
    key: 'failed-callbacks',
    label: 'Failed Callbacks (24h)',
    count: failedCallbacks24h,
    hint: 'M-Pesa callbacks that failed or were unmatched',
    href: '/payments?status=failed',
    severity: failedCallbacks24h > 0 ? 'error' : 'success'
  }
]

const buildAdminAlerts = queues => {
  const alerts = []
  const failedCallbacks = queues.find(item => item.key === 'failed-callbacks')
  const roleApprovals = queues.find(item => item.key === 'role-approvals')
  const complianceQueue = queues.find(item => item.key === 'compliance-queue')

  if (failedCallbacks?.count > 0) {
    alerts.push({
      key: 'failed-callbacks',
      severity: 'error',
      message: `${failedCallbacks.count} payment callbacks failed in the last 24 hours.`,
      href: failedCallbacks.href
    })
  }

  if (roleApprovals?.count > 0) {
    alerts.push({
      key: 'role-approvals',
      severity: 'warning',
      message: `${roleApprovals.count} role approval requests are waiting review.`,
      href: roleApprovals.href
    })
  }

  if (complianceQueue?.count > 0) {
    alerts.push({
      key: 'compliance-queue',
      severity: 'warning',
      message: `${complianceQueue.count} compliance tasks are pending or blocked.`,
      href: complianceQueue.href
    })
  }

  return alerts
}

const mergeAdminRpcMetrics = rpcMetrics => {
  if (!isPlainObject(rpcMetrics)) {
    return DEFAULT_ADMIN_METRICS
  }

  const analytics = isPlainObject(rpcMetrics.analytics) ? rpcMetrics.analytics : {}
  const line = isPlainObject(analytics.line) ? analytics.line : {}
  const sessions = isPlainObject(analytics.sessions) ? analytics.sessions : {}

  return {
    ...DEFAULT_ADMIN_METRICS,
    ...rpcMetrics,
    analytics: {
      ...DEFAULT_ADMIN_METRICS.analytics,
      ...analytics,
      line: {
        ...DEFAULT_ADMIN_METRICS.analytics.line,
        ...line
      },
      sessions: {
        ...DEFAULT_ADMIN_METRICS.analytics.sessions,
        ...sessions
      }
    }
  }
}

const mergeSimpleRpcMetrics = (defaults, rpcMetrics) => {
  if (!isPlainObject(rpcMetrics)) {
    return defaults
  }

  return {
    ...defaults,
    ...rpcMetrics
  }
}

const mergeLandlordRpcMetrics = rpcMetrics => {
  if (!isPlainObject(rpcMetrics)) {
    return DEFAULT_LANDLORD_METRICS
  }

  const analytics = isPlainObject(rpcMetrics.analytics) ? rpcMetrics.analytics : {}
  const weeklyOverview = isPlainObject(analytics.weeklyOverview) ? analytics.weeklyOverview : {}
  const totalEarning = isPlainObject(analytics.totalEarning) ? analytics.totalEarning : {}

  return {
    ...DEFAULT_LANDLORD_METRICS,
    ...rpcMetrics,
    analytics: {
      ...DEFAULT_LANDLORD_METRICS.analytics,
      ...analytics,
      weeklyOverview: {
        ...DEFAULT_LANDLORD_METRICS.analytics.weeklyOverview,
        ...weeklyOverview
      },
      totalEarning: {
        ...DEFAULT_LANDLORD_METRICS.analytics.totalEarning,
        ...totalEarning
      }
    }
  }
}

const collectError = (errors, ...entries) => {
  entries.forEach(entry => {
    if (entry?.error) {
      errors.push(entry.error)
    }
  })
}

const isColumnMissingError = error => {
  const message = String(error?.message || '').toLowerCase()

  return message.includes('column') && message.includes('does not exist')
}

const withOwnerFilter = (query, ownerIds) => (ownerIds.length ? query.in('owner_id', ownerIds) : query)

const dedupeRows = rows => {
  const seen = new Set()

  return (rows || []).filter(row => {
    const key = JSON.stringify(row)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)

    return true
  })
}

const countVacancyRate = (occupiedUnits, totalUnits) => (totalUnits > 0 ? `${Math.round((occupiedUnits / totalUnits) * 100)}%` : '0%')

export const getAdminDashboardMetrics = async context => {
  const { supabase, userId, error: scopeError } = await getOwnerScope(context)
  const errors = []

  if (scopeError) {
    errors.push(scopeError)
  }

  if (!supabase || !userId) {
    return withDefault(DEFAULT_ADMIN_METRICS, summarizeErrors(errors) || 'Authentication required.')
  }

  const rpc = await tryLoadDashboardMetricsRpc(supabase, 'admin')
  let baseMetrics = rpc.metrics ? mergeAdminRpcMetrics(rpc.metrics) : null
  const { startOfCurrentMonth } = getCurrentAndPreviousMonthWindow()
  const last24HoursIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const analyticsStartIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [analyticsPayments, analyticsAudits] = await Promise.all([
    runQuery(
      supabase
        .from('payments')
        .select('amount,created_at')
        .in('status', ['paid', 'partial'])
        .gte('created_at', analyticsStartIso)
    ),
    runQuery(supabase.from('admin_audit_logs').select('event_time').gte('event_time', analyticsStartIso))
  ])

  collectError(errors, analyticsPayments, analyticsAudits)

  const analytics = buildAdminAnalytics({
    paymentRows: analyticsPayments.data,
    auditRows: analyticsAudits.data
  })

  const [roleRequests, pendingAuditActionsResult, pendingProofReviewsResult, failedCallbacksResult] = await Promise.all([
    runQuery(
      supabase
        .from('profiles')
        .select('id,role,requested_role')
        .not('requested_role', 'is', null)
        .or('account_status.is.null,account_status.neq.deactivated')
        .limit(5000)
    ),
    runCount(
      supabase
        .from('admin_audit_logs')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'blocked'])
    ),
    runCount(
      supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'Tenant Payment Proof')
        .eq('status', 'pending review')
    ),
    runCount(
      supabase
        .from('payment_provider_events')
        .select('id', { count: 'exact', head: true })
        .in('status', ['failed', 'unmatched'])
        .gte('created_at', last24HoursIso)
    )
  ])

  if (roleRequests.error && !isMissingRelationError(roleRequests.error)) {
    errors.push(roleRequests.error)
  }

  if (pendingAuditActionsResult.error && !isMissingRelationError(pendingAuditActionsResult.error)) {
    errors.push(pendingAuditActionsResult.error)
  }

  if (pendingProofReviewsResult.error && !isMissingRelationError(pendingProofReviewsResult.error)) {
    errors.push(pendingProofReviewsResult.error)
  }

  if (failedCallbacksResult.error && !isMissingRelationError(failedCallbacksResult.error)) {
    errors.push(failedCallbacksResult.error)
  }

  const pendingRoleApprovals = (roleRequests.data || []).reduce((count, row) => {
    const role = normalizeStatus(row?.role)
    const requestedRole = normalizeStatus(row?.requested_role)

    if (!requestedRole) {
      return count
    }

    return requestedRole !== role ? count + 1 : count
  }, 0)

  const pendingAuditActions = pendingAuditActionsResult.count
  const pendingProofReviews = pendingProofReviewsResult.count
  const failedCallbacks24h = failedCallbacksResult.count

  const actionQueues = buildAdminActionQueues({
    pendingRoleApprovals,
    pendingAuditActions,
    pendingProofReviews,
    failedCallbacks24h
  })

  const alerts = buildAdminAlerts(actionQueues)

  if (baseMetrics) {
    return withDefault(
      {
        ...baseMetrics,
        actionQueues,
        alerts,
        analytics
      },
      summarizeErrors(errors)
    )
  }

  const [landlords, subscriptions, plots, occupiedUnits, payments, audits24h] = await Promise.all([
    runCount(
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'landlord')
        .or('account_status.is.null,account_status.neq.deactivated')
    ),
    runCount(
      supabase
        .from('landlord_subscriptions')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'trial'])
    ),
    runCount(supabase.from('plots').select('id', { count: 'exact', head: true })),
    runCount(supabase.from('units').select('id', { count: 'exact', head: true }).eq('status', 'occupied')),
    runQuery(
      supabase
        .from('payments')
        .select('amount')
        .in('status', ['paid', 'partial'])
        .gte('created_at', startOfCurrentMonth.toISOString())
    ),
    runCount(supabase.from('admin_audit_logs').select('id', { count: 'exact', head: true }).gte('event_time', last24HoursIso))
  ])

  collectError(errors, landlords, subscriptions, plots, occupiedUnits, payments, audits24h)

  const transactions = sumBy(payments.data, 'amount')

  return withDefault(
    {
      verifiedLandlords: landlords.count,
      activeSubscriptions: subscriptions.error ? landlords.count : subscriptions.count,
      platformTransactions: formatKES(transactions),
      auditEvents24h: audits24h.count,
      totalPlots: plots.count,
      occupiedUnits: occupiedUnits.count,
      actionQueues,
      alerts,
      analytics
    },
    summarizeErrors(errors)
  )
}

export const getLandlordDashboardMetrics = async context => {
  const { supabase, userId, error: scopeError } = await getOwnerScope(context)
  const errors = []

  if (scopeError) {
    errors.push(scopeError)
  }

  if (!supabase || !userId) {
    return withDefault(DEFAULT_LANDLORD_METRICS, summarizeErrors(errors) || 'Authentication required.')
  }

  const rpc = await tryLoadDashboardMetricsRpc(supabase, 'landlord')

  if (rpc.metrics) {
    return withDefault(mergeLandlordRpcMetrics(rpc.metrics), summarizeErrors(errors))
  }

  const { startOfPreviousMonth } = getCurrentAndPreviousMonthWindow()

  const [totalPlots, totalUnits, occupiedUnits, vacantUnits, payments, pendingInvoices, arrearsTenants, openMaintenance] =
    await Promise.all([
      runCount(supabase.from('plots').select('id', { count: 'exact', head: true }).eq('owner_id', userId)),
      runCount(supabase.from('units').select('id', { count: 'exact', head: true }).eq('owner_id', userId)),
      runCount(
        supabase.from('units').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', 'occupied')
      ),
      runCount(
        supabase.from('units').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', 'vacant')
      ),
      runQuery(
        supabase
          .from('payments')
          .select('amount,channel,created_at')
          .eq('owner_id', userId)
          .in('status', ['paid', 'partial'])
          .gte('created_at', startOfPreviousMonth.toISOString())
      ),
      runCount(
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .in('status', ['pending', 'partial', 'overdue'])
      ),
      runCount(
        supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('payment_status', 'arrears')
      ),
      runCount(
        supabase
          .from('maintenance_requests')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', userId)
          .neq('status', 'completed')
      )
    ])

  collectError(errors, totalPlots, totalUnits, occupiedUnits, vacantUnits, payments, pendingInvoices, arrearsTenants, openMaintenance)

  const rentPayments = payments.data
  const totalEarning = buildTotalEarning(rentPayments)
  const rentCollected = toNumber(totalEarning.currentMonthTotal)
  const weeklyOverview = buildWeeklyOverview(rentPayments)

  return withDefault(
    {
      totalPlots: totalPlots.count,
      totalUnits: totalUnits.count,
      occupiedUnits: occupiedUnits.count,
      vacantUnits: vacantUnits.count,
      occupancyRate: countVacancyRate(occupiedUnits.count, totalUnits.count),
      rentCollected: formatKES(rentCollected),
      pendingInvoices: pendingInvoices.count,
      arrearsTenants: arrearsTenants.count,
      openMaintenance: openMaintenance.count,
      analytics: {
        weeklyOverview,
        totalEarning
      }
    },
    summarizeErrors(errors)
  )
}

export const getAgentDashboardMetrics = async context => {
  const { supabase, userId, error: scopeError } = await getOwnerScope(context)
  const errors = []

  if (scopeError) {
    errors.push(scopeError)
  }

  if (!supabase || !userId) {
    return withDefault(DEFAULT_AGENT_METRICS, summarizeErrors(errors) || 'Authentication required.')
  }

  const rpc = await tryLoadDashboardMetricsRpc(supabase, 'agent')

  if (rpc.metrics) {
    return withDefault(mergeSimpleRpcMetrics(DEFAULT_AGENT_METRICS, rpc.metrics), summarizeErrors(errors))
  }

  const weekStart = new Date()

  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())

  const weekEnd = new Date(weekStart)

  weekEnd.setDate(weekEnd.getDate() + 7)

  const [activeListings, viewingsThisWeek, pendingTenancies, openTickets, unreadOrPendingMessages] = await Promise.all([
    runCount(supabase.from('units').select('id', { count: 'exact', head: true }).eq('owner_id', userId).eq('status', 'vacant')),
    runCount(
      supabase
        .from('viewing_appointments')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .gte('preferred_time', weekStart.toISOString())
        .lt('preferred_time', weekEnd.toISOString())
    ),
    runCount(
      supabase
        .from('tenancies')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .in('status', ['pending', 'move-out scheduled'])
    ),
    runCount(
      supabase
        .from('maintenance_requests')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .neq('status', 'completed')
    ),
    runCount(
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId)
        .neq('status', 'completed')
    )
  ])

  collectError(errors, activeListings, viewingsThisWeek, pendingTenancies, openTickets, unreadOrPendingMessages)

  return withDefault(
    {
      activeListings: activeListings.count,
      viewingsThisWeek: viewingsThisWeek.count,
      pendingTenancies: pendingTenancies.count,
      openTickets: openTickets.count,
      unreadOrPendingMessages: unreadOrPendingMessages.count
    },
    summarizeErrors(errors)
  )
}

const loadTenantRowsByScope = async (supabase, tenantScope) => {
  const tenantIds = tenantScope?.tenantIds || []
  const tenantNames = tenantScope?.tenantNames || []
  const ownerIds = tenantScope?.ownerIds || []
  const unitCodes = tenantScope?.unitCodes || []

  if (!tenantIds.length && !tenantNames.length && !unitCodes.length) {
    return {
      payments: [],
      invoices: [],
      maintenance: [],
      errors: []
    }
  }

  const errors = []
  const invoiceRows = []
  const paymentRows = []
  const maintenanceRows = []

  let allowLegacyInvoiceNameFallback = !tenantIds.length && tenantNames.length > 0

  if (tenantIds.length) {
    const invoicesById = await runQuery(withOwnerFilter(supabase.from('invoices').select('id,due_amount,status,tenant_name'), ownerIds).in('tenant_id', tenantIds))

    if (invoicesById.error) {
      if (isColumnMissingError(invoicesById.error)) {
        allowLegacyInvoiceNameFallback = true
      } else {
        errors.push(invoicesById.error)
      }
    } else {
      invoiceRows.push(...invoicesById.data)
    }
  }

  if (allowLegacyInvoiceNameFallback && tenantNames.length) {
    const invoicesByName = await runQuery(withOwnerFilter(supabase.from('invoices').select('id,due_amount,status,tenant_name'), ownerIds).in('tenant_name', tenantNames))

    if (invoicesByName.error) {
      errors.push(invoicesByName.error)
    } else {
      invoiceRows.push(...invoicesByName.data)
    }
  }

  const invoices = dedupeRows(invoiceRows)
  const invoiceIds = invoices.map(row => row.id).filter(Boolean)
  let allowLegacyPaymentNameFallback = !invoiceIds.length && tenantNames.length > 0

  if (invoiceIds.length) {
    const paymentsByInvoice = await runQuery(withOwnerFilter(supabase.from('payments').select('amount,status,tenant_name'), ownerIds).in('invoice_id', invoiceIds))

    if (paymentsByInvoice.error) {
      if (isColumnMissingError(paymentsByInvoice.error)) {
        allowLegacyPaymentNameFallback = true
      } else {
        errors.push(paymentsByInvoice.error)
      }
    } else {
      paymentRows.push(...paymentsByInvoice.data)
    }
  }

  if (allowLegacyPaymentNameFallback && tenantNames.length) {
    const paymentsByName = await runQuery(withOwnerFilter(supabase.from('payments').select('amount,status,tenant_name'), ownerIds).in('tenant_name', tenantNames))

    if (paymentsByName.error) {
      errors.push(paymentsByName.error)
    } else {
      paymentRows.push(...paymentsByName.data)
    }
  }

  let allowLegacyMaintenanceUnitFallback = !tenantIds.length && unitCodes.length > 0

  if (tenantIds.length) {
    const maintenanceById = await runQuery(withOwnerFilter(supabase.from('maintenance_requests').select('status,unit_code'), ownerIds).in('tenant_id', tenantIds))

    if (maintenanceById.error) {
      if (isColumnMissingError(maintenanceById.error)) {
        allowLegacyMaintenanceUnitFallback = true
      } else {
        errors.push(maintenanceById.error)
      }
    } else {
      maintenanceRows.push(...maintenanceById.data)
    }
  }

  if (allowLegacyMaintenanceUnitFallback && unitCodes.length) {
    const maintenanceByUnit = await runQuery(
      withOwnerFilter(supabase.from('maintenance_requests').select('status,unit_code'), ownerIds).in('unit_code', unitCodes)
    )

    if (maintenanceByUnit.error) {
      errors.push(maintenanceByUnit.error)
    } else {
      maintenanceRows.push(...maintenanceByUnit.data)
    }
  }

  return {
    payments: dedupeRows(paymentRows),
    invoices,
    maintenance: dedupeRows(maintenanceRows),
    errors
  }
}

const loadActiveTenantTenancies = async (supabase, tenantScope) => {
  const tenantIds = tenantScope?.tenantIds || []
  const tenantNames = tenantScope?.tenantNames || []
  const ownerIds = tenantScope?.ownerIds || []

  if (!tenantIds.length && !tenantNames.length) {
    return {
      activePlotRefs: [],
      activeUnitIds: [],
      activeUnitCodes: [],
      errors: []
    }
  }

  const errors = []
  const rows = []
  let allowLegacyTenantNameFallback = !tenantIds.length && tenantNames.length > 0

  if (tenantIds.length) {
    const byTenantId = await runQuery(
      withOwnerFilter(supabase.from('tenancies').select('unit_id,unit_code,plot_ref,owner_id,status'), ownerIds)
        .in('tenant_id', tenantIds)
        .in('status', ['active', 'move-out scheduled'])
    )

    if (byTenantId.error) {
      if (isColumnMissingError(byTenantId.error)) {
        allowLegacyTenantNameFallback = true
      } else {
        errors.push(byTenantId.error)
      }
    } else {
      rows.push(...byTenantId.data)
    }
  }

  if (allowLegacyTenantNameFallback && tenantNames.length) {
    const byTenantName = await runQuery(
      withOwnerFilter(supabase.from('tenancies').select('unit_code,owner_id,status'), ownerIds)
        .in('tenant_name', tenantNames)
        .in('status', ['active', 'move-out scheduled'])
    )

    if (byTenantName.error) {
      errors.push(byTenantName.error)
    } else {
      rows.push(...byTenantName.data)
    }
  }

  const deduped = dedupeRows(rows)

  return {
    activePlotRefs: [...new Set(deduped.map(row => row.plot_ref).filter(Boolean))],
    activeUnitIds: [...new Set(deduped.map(row => row.unit_id).filter(Boolean))],
    activeUnitCodes: [...new Set(deduped.map(row => row.unit_code).filter(Boolean))],
    errors
  }
}

export const getTenantDashboardMetrics = async context => {
  const { supabase, userId, error: scopeError } = await getOwnerScope(context)
  const errors = []

  if (scopeError) {
    errors.push(scopeError)
  }

  if (!supabase || !userId) {
    return withDefault(DEFAULT_TENANT_METRICS, summarizeErrors(errors) || 'Authentication required.')
  }

  const rpc = await tryLoadDashboardMetricsRpc(supabase, 'tenant')

  if (rpc.metrics) {
    return withDefault(mergeSimpleRpcMetrics(DEFAULT_TENANT_METRICS, rpc.metrics), summarizeErrors(errors))
  }

  const tenantProfiles = await runQuery(supabase.from('tenants').select('id,owner_id,tenant_name,unit_code').eq('auth_user_id', userId))

  collectError(errors, tenantProfiles)

  const tenantScope = {
    tenantIds: tenantProfiles.data.map(row => row.id).filter(Boolean),
    tenantNames: tenantProfiles.data.map(row => row.tenant_name).filter(Boolean),
    ownerIds: [...new Set(tenantProfiles.data.map(row => row.owner_id).filter(Boolean))],
    unitCodes: [...new Set(tenantProfiles.data.map(row => row.unit_code).filter(Boolean))]
  }

  const byIds = await loadTenantRowsByScope(supabase, tenantScope)

  errors.push(...byIds.errors)

  const payments = byIds.payments
  const invoices = byIds.invoices
  const maintenance = byIds.maintenance

  const tenancyScope = await loadActiveTenantTenancies(supabase, tenantScope)
  const activePlotRefs = tenancyScope.activePlotRefs
  const activeUnitIds = tenancyScope.activeUnitIds
  const activeUnitCodes = tenancyScope.activeUnitCodes

  errors.push(...tenancyScope.errors)

  let relocationUnitsCount = 0
  let shouldUseOwnerFallback = !activePlotRefs.length

  if (activePlotRefs.length) {
    const relocationUnitsByPlot = await runQuery(
      supabase.from('units').select('id,unit_id').in('plot_ref', activePlotRefs).eq('status', 'vacant')
    )

    if (relocationUnitsByPlot.error) {
      if (isColumnMissingError(relocationUnitsByPlot.error)) {
        shouldUseOwnerFallback = true
      } else {
        errors.push(relocationUnitsByPlot.error)
      }
    } else {
      shouldUseOwnerFallback = false

      relocationUnitsCount = relocationUnitsByPlot.data.filter(
        row => !activeUnitIds.includes(row.id) && !activeUnitCodes.includes(row.unit_id)
      ).length
    }
  }

  if (shouldUseOwnerFallback && tenantScope.ownerIds.length) {
    const relocationUnits = await runQuery(
      supabase.from('units').select('id,unit_id').in('owner_id', tenantScope.ownerIds).eq('status', 'vacant')
    )

    collectError(errors, relocationUnits)
    relocationUnitsCount = relocationUnits.data.filter(row => !activeUnitIds.includes(row.id) && !activeUnitCodes.includes(row.unit_id)).length
  }

  const dueAmount = sumBy(invoices, 'due_amount')
  const paidAmount = sumBy(payments, 'amount')
  const rentBalance = Math.max(0, dueAmount - paidAmount)
  const paidInvoices = invoices.filter(row => normalizeStatus(row.status) === 'paid').length
  const invoiceCount = invoices.length

  let paymentStatus = 'No invoices'

  if (invoiceCount > 0 && paidInvoices === invoiceCount) {
    paymentStatus = 'Paid'
  } else if (paidAmount > 0) {
    paymentStatus = 'Partial'
  } else if (invoiceCount > 0) {
    paymentStatus = 'Pending'
  }

  const openRequests = maintenance.filter(row => normalizeStatus(row.status) !== 'completed').length

  return withDefault(
    {
      rentBalance: formatKES(rentBalance),
      paidThisMonth: formatKES(paidAmount),
      paymentStatus,
      openRequests,
      relocationUnits: relocationUnitsCount
    },
    summarizeErrors(errors)
  )
}
