import assert from 'node:assert/strict'
import test from 'node:test'

import { API_ERROR_CODES } from './apiErrors.js'
import { API_RESPONSES } from './apiResponses.js'

const makeRequest = ({ method = 'GET', headers = {} } = {}) =>
  new Request('https://app.mambaproperties.test/api/example', {
    method,
    headers
  })

test('API_RESPONSES.ok returns success payload contract with request id', async () => {
  const request = makeRequest({
    headers: {
      'x-request-id': 'req-contract-123'
    }
  })

  const response = API_RESPONSES.ok(
    request,
    {
      hello: 'world'
    },
    {
      headers: {
        'Cache-Control': 'no-store'
      }
    }
  )

  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-request-id'), 'req-contract-123')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(body.success, true)
  assert.equal(body.hello, 'world')
  assert.equal(body.requestId, 'req-contract-123')
})

test('API_RESPONSES.badRequest returns standardized error payload', async () => {
  const request = makeRequest({
    headers: {
      'x-request-id': 'req-error-123'
    }
  })

  const details = {
    field: 'email'
  }

  const response = API_RESPONSES.badRequest(request, 'Invalid    payload. ', details)
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.success, false)
  assert.equal(body.error, 'Invalid payload')
  assert.equal(body.errorCode, API_ERROR_CODES.BAD_REQUEST)
  assert.deepEqual(body.errorDetails, details)
  assert.deepEqual(body.errorInfo, {
    code: API_ERROR_CODES.BAD_REQUEST,
    message: 'Invalid payload',
    details
  })
  assert.equal(body.requestId, 'req-error-123')
})

test('API_RESPONSES.fromError maps status to default error code', async () => {
  const request = makeRequest()

  const response = API_RESPONSES.fromError(request, new Error('Upstream timeout.'), {
    status: 503
  })

  const body = await response.json()

  assert.equal(response.status, 503)
  assert.equal(body.success, false)
  assert.equal(body.error, 'Upstream timeout')
  assert.equal(body.errorCode, API_ERROR_CODES.SERVICE_UNAVAILABLE)
  assert.ok(typeof body.requestId === 'string' && body.requestId.length > 0)
})

test('API_RESPONSES.payloadTooLarge returns 413 payload', async () => {
  const request = makeRequest({
    headers: {
      'x-request-id': 'req-payload-413'
    }
  })

  const response = API_RESPONSES.payloadTooLarge(request, 'Payload too big.', {
    maxBytes: 1024
  })

  const body = await response.json()

  assert.equal(response.status, 413)
  assert.equal(body.success, false)
  assert.equal(body.error, 'Payload too big')
  assert.equal(body.errorCode, API_ERROR_CODES.PAYLOAD_TOO_LARGE)
  assert.deepEqual(body.errorDetails, { maxBytes: 1024 })
  assert.equal(body.requestId, 'req-payload-413')
})
