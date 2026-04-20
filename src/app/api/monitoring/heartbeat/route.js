import { API_RESPONSES } from '@/libs/api/apiResponses'
import { dispatchOpsAlert, getOpsAlertConfig } from '@/libs/monitoring/opsAlerts'
import { getSystemHealthSnapshot } from '@/libs/monitoring/systemHealth'

const toText = value => String(value || '').trim()

const readMonitoringKey = () => toText(process.env.MONITORING_CRON_KEY)

const getPresentedMonitoringKey = request => {
  const authHeader = toText(request.headers.get('authorization'))

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return toText(authHeader.slice(7))
  }

  return toText(request.headers.get('x-monitoring-key'))
}

const isAuthorizedMonitor = request => {
  const expected = readMonitoringKey()
  const provided = getPresentedMonitoringKey(request)

  return Boolean(expected && provided && expected === provided)
}

export async function GET(request) {
  const monitoringKey = readMonitoringKey()

  if (!monitoringKey) {
    return API_RESPONSES.unavailable(request, 'Monitoring heartbeat is not configured. Set MONITORING_CRON_KEY.')
  }

  if (!isAuthorizedMonitor(request)) {
    return API_RESPONSES.forbidden(request, 'Invalid monitoring key.')
  }

  const snapshot = await getSystemHealthSnapshot()
  const alertConfig = getOpsAlertConfig()

  if (!snapshot.ready) {
    const alertResult = await dispatchOpsAlert({
      title: 'MambaProperties readiness degraded',
      message: 'Supabase dependency is down or unreachable from readiness checks.',
      severity: 'critical',
      context: snapshot
    })

    return API_RESPONSES.unavailable(request, 'Monitoring heartbeat detected a degraded system state.', {
      ready: false,
      timestamp: snapshot.timestamp,
      dependencies: snapshot.dependencies,
      alerting: {
        enabled: alertConfig.enabled,
        provider: alertConfig.provider,
        minIntervalMs: alertConfig.minIntervalMs,
        dispatched: alertResult.delivered === true,
        skipped: alertResult.skipped === true,
        reason: alertResult.reason || null
      }
    })
  }

  return API_RESPONSES.ok(
    request,
    {
      status: 'healthy',
      ready: true,
      timestamp: snapshot.timestamp,
      dependencies: snapshot.dependencies,
      alerting: {
        enabled: alertConfig.enabled,
        provider: alertConfig.provider,
        minIntervalMs: alertConfig.minIntervalMs
      }
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}
