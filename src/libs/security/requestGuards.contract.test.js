import assert from 'node:assert/strict'
import test from 'node:test'

import { enforceSameOriginMutation } from './requestGuards.js'

const makeRequest = ({ origin, referer, method = 'POST' } = {}) =>
  new Request('https://app.mambaproperties.test/api/modules/units', {
    method,
    headers: {
      host: 'app.mambaproperties.test',
      'x-forwarded-host': 'app.mambaproperties.test',
      'x-forwarded-proto': 'https',
      ...(origin ? { origin } : {}),
      ...(referer ? { referer } : {})
    }
  })

test('enforceSameOriginMutation allows safe methods', () => {
  const request = makeRequest({ method: 'GET' })
  const response = enforceSameOriginMutation(request)

  assert.equal(response, null)
})

test('enforceSameOriginMutation allows matching origin', () => {
  const request = makeRequest({ origin: 'https://app.mambaproperties.test' })
  const response = enforceSameOriginMutation(request)

  assert.equal(response, null)
})

test('enforceSameOriginMutation blocks mismatched origin with API error contract', async () => {
  const request = makeRequest({ origin: 'https://evil.attacker.test' })
  const response = enforceSameOriginMutation(request)

  assert.ok(response)
  assert.equal(response.status, 403)
  assert.equal(response.headers.get('x-request-id') !== null, true)

  const body = await response.json()

  assert.equal(body.success, false)
  assert.equal(body.error, 'Forbidden request origin')
  assert.equal(body.errorCode, 'FORBIDDEN')
  assert.equal(body.errorInfo.code, 'FORBIDDEN')
})
