import assert from 'node:assert/strict'
import test from 'node:test'

import { buildContentSecurityPolicy } from './csp.js'

test('production CSP uses nonce-based script policy', () => {
  const policy = buildContentSecurityPolicy({ nonce: 'test-nonce', isDev: false })

  assert.match(policy, /script-src 'self' 'nonce-test-nonce' 'strict-dynamic'/)
  assert.equal(policy.includes("'unsafe-eval'"), false)
})

test('development CSP keeps eval for local HMR', () => {
  const policy = buildContentSecurityPolicy({ nonce: 'test-nonce', isDev: true })

  assert.match(policy, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/)
  assert.match(policy, /connect-src 'self' http:\/\/localhost:\* ws:\/\/localhost:\*/)
})
