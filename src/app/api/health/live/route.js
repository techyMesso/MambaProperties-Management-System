import { API_RESPONSES } from '@/libs/api/apiResponses'
import { publicCacheHeaders } from '@/libs/api/cacheHeaders'

export async function GET(request) {
  return API_RESPONSES.ok(
    request,
    {
      status: 'ok',
      service: 'mambaproperties-web',
      timestamp: new Date().toISOString()
    },
    {
      headers: publicCacheHeaders({ maxAge: 10, sMaxAge: 30, staleWhileRevalidate: 60 })
    }
  )
}
