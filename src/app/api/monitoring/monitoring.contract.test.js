import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = process.cwd()

const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8')

test('heartbeat endpoint requires monitoring key and can dispatch alerts', () => {
  const source = read('src/app/api/monitoring/heartbeat/route.js')

  assert.match(source, /MONITORING_CRON_KEY/)
  assert.match(source, /dispatchOpsAlert/)
  assert.match(source, /Invalid monitoring key/)
})

test('admin system health endpoint exposes monitor auth contract for operators', () => {
  const source = read('src/app/api/admin/system-health/route.js')

  assert.match(source, /Authorization: Bearer <MONITORING_CRON_KEY>/)
  assert.match(source, /requireAdminContext\(request\)/)
})
