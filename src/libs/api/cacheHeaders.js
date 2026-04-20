const clampInt = (value, fallback) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(0, Math.floor(parsed))
}

export const publicCacheHeaders = ({ maxAge = 30, sMaxAge = 30, staleWhileRevalidate = 120 } = {}) => {
  const resolvedMaxAge = clampInt(maxAge, 0)
  const resolvedSMaxAge = clampInt(sMaxAge, resolvedMaxAge)
  const resolvedStale = clampInt(staleWhileRevalidate, 0)

  const directives = [
    'public',
    `max-age=${resolvedMaxAge}`,
    `s-maxage=${resolvedSMaxAge}`,
    `stale-while-revalidate=${resolvedStale}`
  ]

  return {
    'Cache-Control': directives.join(', ')
  }
}

