const CLIENT_DEBUG_FLAG = 'mp:auth-perf'

const readClientDebugFlag = () => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(CLIENT_DEBUG_FLAG) === '1'
  } catch {
    return false
  }
}

export const isAuthPerfEnabled = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_AUTH_PERF === '1' || readClientDebugFlag()
  }

  return process.env.AUTH_PERF_LOGS === '1'
}

const nowMs = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }

  return Date.now()
}

const toRoundedMs = value => Number(value.toFixed(1))

export const createAuthPerfLogger = (scope, base = {}) => {
  const enabled = isAuthPerfEnabled()
  const start = nowMs()
  const marks = []

  const mark = (step, detail = {}) => {
    if (!enabled) {
      return
    }

    marks.push({
      step,
      atMs: toRoundedMs(nowMs() - start),
      ...detail
    })
  }

  const done = (detail = {}) => {
    if (!enabled) {
      return null
    }

    const payload = {
      scope,
      totalMs: toRoundedMs(nowMs() - start),
      marks,
      ...base,
      ...detail
    }

    if (typeof window === 'undefined') {
      console.info('[auth-perf]', JSON.stringify(payload))
    } else {
      console.info('[auth-perf]', payload)
    }

    return payload
  }

  return {
    enabled,
    mark,
    done
  }
}
