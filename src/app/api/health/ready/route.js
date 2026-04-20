import { API_RESPONSES } from '@/libs/api/apiResponses'
import { getSystemHealthSnapshot } from '@/libs/monitoring/systemHealth'

export async function GET(request) {
  const snapshot = await getSystemHealthSnapshot()

  if (!snapshot.ready) {
    return API_RESPONSES.unavailable(request, 'Readiness failed: Supabase is unreachable or unhealthy.')
  }

  return API_RESPONSES.ok(request, {
    status: 'ready',
    service: 'mambaproperties-web',
    timestamp: snapshot.timestamp,
    dependencies: snapshot.dependencies
  })
}
