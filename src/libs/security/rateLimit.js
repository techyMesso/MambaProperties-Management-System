import { API_RESPONSES } from '../api/apiResponses.js'

const RATE_LIMIT_BUCKETS = new Map()
const MAX_BUCKETS = 10_000
const SWEEP_INTERVAL_MS = 60_000
let lastSweepAt = 0

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.floor(parsed)
}

const toText = value => String(value || '').trim()

const normalizeWindow = value => Math.max(1_000, toPositiveInt(value, 60_000))
const normalizeLimit = value => Math.max(1, toPositiveInt(value, 60))
const normalizeTimeout = value => Math.max(200, toPositiveInt(value, 1_200))

const pruneExpiredBuckets = now => {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) {
    return
  }

  lastSweepAt = now

  for (const [key, bucket] of RATE_LIMIT_BUCKETS.entries()) {
    if (!bucket || bucket.resetAt <= now) {
      RATE_LIMIT_BUCKETS.delete(key)
    }
  }

  if (RATE_LIMIT_BUCKETS.size <= MAX_BUCKETS) {
    return
  }

  const sorted = [...RATE_LIMIT_BUCKETS.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
  const overflow = RATE_LIMIT_BUCKETS.size - MAX_BUCKETS

  for (let index = 0; index < overflow; index += 1) {
    RATE_LIMIT_BUCKETS.delete(sorted[index][0])
  }
}

const getClientIp = request => {
  const forwarded = toText(request?.headers?.get?.('x-forwarded-for'))

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return (
    toText(request?.headers?.get?.('x-real-ip')) ||
    toText(request?.headers?.get?.('cf-connecting-ip')) ||
    'unknown'
  )
}

const buildBucketKey = ({ scope, identifier, ip }) => `${scope}:${identifier || ip || 'unknown'}`

const buildNamespacedKey = key => {
  const namespace = toText(process.env.RATE_LIMIT_NAMESPACE || 'mamba:rl')

  return `${namespace}:${key}`
}

const getUpstashConfig = () => {
  const baseUrl = toText(process.env.UPSTASH_REDIS_REST_URL).replace(/\/+$/, '')
  const token = toText(process.env.UPSTASH_REDIS_REST_TOKEN)

  if (!baseUrl || !token) {
    return null
  }

  return {
    baseUrl,
    token,
    timeoutMs: normalizeTimeout(process.env.UPSTASH_REDIS_TIMEOUT_MS)
  }
}

const parseUpstashPipelineResult = (payload, index) => {
  const entries = Array.isArray(payload) ? payload : Array.isArray(payload?.result) ? payload.result : []
  const entry = entries[index]

  if (entry && typeof entry === 'object' && 'result' in entry) {
    return entry.result
  }

  if (Array.isArray(entry)) {
    if (entry.length >= 2) {
      return entry[1]
    }

    return entry[0] ?? null
  }

  return entry ?? null
}

const runUpstashPipeline = async (config, commands) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(`${config.baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands),
      cache: 'no-store',
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`Upstash request failed with status ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

const consumeRateLimitLocal = ({ key, limit, windowMs }) => {
  const now = Date.now()

  pruneExpiredBuckets(now)

  const existing = RATE_LIMIT_BUCKETS.get(key)
  const isNewWindow = !existing || existing.resetAt <= now

  const bucket = isNewWindow
    ? {
        hits: 0,
        resetAt: now + windowMs
      }
    : existing

  if (bucket.hits >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))

    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds,
      resetAt: bucket.resetAt
    }
  }

  bucket.hits += 1
  RATE_LIMIT_BUCKETS.set(key, bucket)

  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.hits),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    resetAt: bucket.resetAt
  }
}

const consumeRateLimitDistributed = async ({ key, limit, windowMs, distributed = true }) => {
  const now = Date.now()
  const upstashConfig = distributed ? getUpstashConfig() : null

  if (!upstashConfig) {
    return consumeRateLimitLocal({ key, limit, windowMs })
  }

  const namespacedKey = buildNamespacedKey(key)

  try {
    const payload = await runUpstashPipeline(upstashConfig, [
      ['INCR', namespacedKey],
      ['PTTL', namespacedKey]
    ])

    const hitsRaw = parseUpstashPipelineResult(payload, 0)
    const ttlRaw = parseUpstashPipelineResult(payload, 1)
    const hits = Number(hitsRaw)
    let ttlMs = Number(ttlRaw)

    if (!Number.isFinite(hits) || hits <= 0) {
      return consumeRateLimitLocal({ key, limit, windowMs })
    }

    if (!Number.isFinite(ttlMs) || ttlMs < 0 || hits === 1) {
      await runUpstashPipeline(upstashConfig, [['PEXPIRE', namespacedKey, String(windowMs)]])
      ttlMs = windowMs
    }

    const resetAt = now + Math.max(1_000, ttlMs)
    const retryAfterSeconds = Math.max(1, Math.ceil(Math.max(1, ttlMs) / 1000))

    if (hits > limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds,
        resetAt
      }
    }

    return {
      ok: true,
      remaining: Math.max(0, limit - hits),
      retryAfterSeconds,
      resetAt
    }
  } catch {
    return consumeRateLimitLocal({ key, limit, windowMs })
  }
}

const buildRateLimitHeaders = ({ limit, remaining, retryAfterSeconds, resetAt }) => ({
  'X-RateLimit-Limit': String(limit),
  'X-RateLimit-Remaining': String(Math.max(0, remaining)),
  'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  'Retry-After': String(Math.max(1, retryAfterSeconds))
})

export const enforceRouteRateLimit = async (
  request,
  {
    scope = 'api',
    identifier = '',
    limit = 60,
    windowMs = 60_000,
    message = 'Too many requests. Please try again shortly.',
    distributed = true
  } = {}
) => {
  const normalizedLimit = normalizeLimit(limit)
  const normalizedWindow = normalizeWindow(windowMs)
  const ip = getClientIp(request)

  const key = buildBucketKey({
    scope: toText(scope) || 'api',
    identifier: toText(identifier),
    ip
  })

  const result = await consumeRateLimitDistributed({
    key,
    limit: normalizedLimit,
    windowMs: normalizedWindow,
    distributed
  })

  if (result.ok) {
    return null
  }

  return API_RESPONSES.rateLimited(
    request,
    message,
    {
      retryAfterSeconds: result.retryAfterSeconds
    },
    buildRateLimitHeaders({
      limit: normalizedLimit,
      remaining: result.remaining,
      retryAfterSeconds: result.retryAfterSeconds,
      resetAt: result.resetAt
    })
  )
}
