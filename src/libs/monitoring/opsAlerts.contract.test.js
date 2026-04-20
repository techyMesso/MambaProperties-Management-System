import assert from 'node:assert/strict'
import test from 'node:test'

import { dispatchOpsAlert, getOpsAlertConfig } from './opsAlerts.js'

test('ops alert config is disabled when webhook env is missing', () => {
  const previous = process.env.ALERT_WEBHOOK_URL

  process.env.ALERT_WEBHOOK_URL = ''

  const config = getOpsAlertConfig()

  assert.equal(config.enabled, false)

  process.env.ALERT_WEBHOOK_URL = previous
})

test('dispatchOpsAlert skips cleanly when webhook is not configured', async () => {
  const previous = process.env.ALERT_WEBHOOK_URL

  process.env.ALERT_WEBHOOK_URL = ''

  const result = await dispatchOpsAlert({
    title: 'test',
    message: 'test message'
  })

  assert.equal(result.delivered, false)
  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'webhook_not_configured')

  process.env.ALERT_WEBHOOK_URL = previous
})
