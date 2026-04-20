import { requireAdminContext } from '@/app/api/admin/_lib/requireAdminContext'
import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { getOpsAlertConfig } from '@/libs/monitoring/opsAlerts'
import { getSystemHealthSnapshot } from '@/libs/monitoring/systemHealth'
import { createAdminClient } from '@/libs/supabase/admin'

export async function GET(request) {
  const context = await requireAdminContext(request)

  if (context.error) {
    return context.error
  }

  const snapshot = await getSystemHealthSnapshot()
  const alertConfig = getOpsAlertConfig()
  const adminSupabase = createAdminClient()
  let dbStatus = {
    status: 'down',
    reason: 'missing_service_key'
  }

  if (adminSupabase) {
    const startedAt = Date.now()
    const dbResult = await safeQuery(adminSupabase.from('profiles').select('id').limit(1))
    const durationMs = Date.now() - startedAt

    dbStatus = dbResult.error
      ? {
          status: 'down',
          durationMs,
          error: dbResult.error?.message || null
        }
      : {
          status: 'up',
          durationMs
        }
  }

  const isHealthy = snapshot.ready && dbStatus.status === 'up'

  return API_RESPONSES.ok(
    request,
    {
      status: isHealthy ? 'healthy' : 'degraded',
      live: {
        status: 'up'
      },
      ready: {
        status: snapshot.ready ? 'up' : 'down',
        dependencies: {
          ...snapshot.dependencies,
          db: dbStatus
        }
      },
      alerting: {
        enabled: alertConfig.enabled,
        provider: alertConfig.provider,
        minIntervalMs: alertConfig.minIntervalMs
      },
      monitor: {
        endpoint: '/api/monitoring/heartbeat',
        authHeader: 'Authorization: Bearer <MONITORING_CRON_KEY>'
      },
      checkedAt: snapshot.timestamp
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}
