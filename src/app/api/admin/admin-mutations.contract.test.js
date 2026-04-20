import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const ROOT = process.cwd()

const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8')

test('admin mutation context enforces service role for write actions', () => {
  const source = read('src/app/api/admin/_lib/requireAdminContext.js')

  assert.match(source, /const requireServiceRole = enforceMutationOrigin === true/)
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY is required for admin write actions/)
})

test('admin write routes use mutation-enforced admin context', () => {
  const routes = [
    'src/app/api/admin/subscriptions/[subscriptionId]/decision/route.js',
    'src/app/api/admin/fees/route.js',
    'src/app/api/admin/fees/[feeId]/route.js'
  ]

  for (const route of routes) {
    const source = read(route)

    assert.match(source, /requireAdminContext\(request, \{ enforceMutationOrigin: true \}\)/, `${route} must enforce mutation origin`)
  }
})
