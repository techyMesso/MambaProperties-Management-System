import { API_RESPONSES } from '@/libs/api/apiResponses'
import { safeQuery } from '@/libs/api/safeQuery'
import { createAdminClient } from '@/libs/supabase/admin'

export async function GET(request) {
  const adminSupabase = createAdminClient()

  if (!adminSupabase) {
    return API_RESPONSES.unavailable(request, 'SUPABASE_SERVICE_ROLE_KEY is required for DB health checks.')
  }

  const startedAt = Date.now()
  const result = await safeQuery(adminSupabase.from('profiles').select('id').limit(1))
  const durationMs = Date.now() - startedAt

  if (result.error) {
    return API_RESPONSES.unavailable(request, 'Database connectivity check failed.')
  }

  return API_RESPONSES.ok(
    request,
    {
      status: 'ok',
      durationMs,
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )
}
