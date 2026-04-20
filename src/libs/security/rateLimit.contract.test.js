import assert from 'node:assert/strict'
import test from 'node:test'

import { enforceRouteRateLimit } from './rateLimit.js'

const makeRequest = (ip = '127.0.0.1') =>
  new Request('https://app.mambaproperties.test/api/account/profile', {
    method: 'POST',
    headers: {
      'x-forwarded-for': ip
    }
  })

const makeScope = () => `contract-${Date.now()}-${Math.random().toString(16).slice(2)}`

test('enforceRouteRateLimit allows requests within configured budget', async () => {
  const request = makeRequest('10.10.10.1')
  const scope = makeScope()

  const first = await enforceRouteRateLimit(request, {
    scope,
    limit: 2,
    windowMs: 60_000,
    distributed: false
  })

  const second = await enforceRouteRateLimit(request, {
    scope,
    limit: 2,
    windowMs: 60_000,
    distributed: false
  })

  assert.equal(first, null)
  assert.equal(second, null)
})

test('enforceRouteRateLimit blocks when budget is exceeded', async () => {
  const request = makeRequest('10.10.10.2')
  const scope = makeScope()

  await enforceRouteRateLimit(request, {
    scope,
    limit: 1,
    windowMs: 60_000,
    distributed: false
  })

  const blocked = await enforceRouteRateLimit(request, {
    scope,
    limit: 1,
    windowMs: 60_000,
    distributed: false
  })

  assert.ok(blocked)
  assert.equal(blocked.status, 429)
  assert.equal(blocked.headers.get('x-ratelimit-limit'), '1')
  assert.equal(blocked.headers.get('x-ratelimit-remaining'), '0')
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1)

  const body = await blocked.json()

  assert.equal(body.success, false)
  assert.equal(body.errorCode, 'RATE_LIMITED')
  assert.ok(Number(body.errorDetails.retryAfterSeconds) >= 1)
})
