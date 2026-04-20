const SUPABASE_HEALTH_TIMEOUT_MS = 1800

const toText = value => String(value || '').trim()

export const getSupabaseEnvState = () => {
  const url = toText(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = toText(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  return {
    ok: Boolean(url && anonKey),
    url,
    anonKey
  }
}

export const checkSupabaseHealth = async ({ url, anonKey, timeoutMs = SUPABASE_HEALTH_TIMEOUT_MS }) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`
      },
      cache: 'no-store',
      signal: controller.signal
    })

    return {
      ok: response.ok,
      status: response.status,
      error: null
    }
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : 'Supabase health check failed'
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export const getSystemHealthSnapshot = async () => {
  const timestamp = new Date().toISOString()
  const envState = getSupabaseEnvState()

  if (!envState.ok) {
    return {
      ready: false,
      timestamp,
      dependencies: {
        supabase: {
          status: 'down',
          reason: 'missing_env'
        }
      }
    }
  }

  const supabaseCheck = await checkSupabaseHealth(envState)

  return {
    ready: supabaseCheck.ok,
    timestamp,
    dependencies: {
      supabase: {
        status: supabaseCheck.ok ? 'up' : 'down',
        httpStatus: supabaseCheck.status,
        error: supabaseCheck.error
      }
    }
  }
}
