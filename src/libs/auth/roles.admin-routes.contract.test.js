import assert from 'node:assert/strict'
import test from 'node:test'

import { canAccessPath, USER_ROLES } from './roles.js'

test('admin-only growth routes are restricted to admin role', () => {
  const adminOnlyRoutes = ['/landlord-leads', '/onboarding-pipeline', '/payments-monitoring', '/income-analytics']

  for (const route of adminOnlyRoutes) {
    assert.equal(canAccessPath(route, USER_ROLES.ADMIN), true, `admin should access ${route}`)
    assert.equal(canAccessPath(route, USER_ROLES.LANDLORD), false, `landlord should not access ${route}`)
    assert.equal(canAccessPath(route, USER_ROLES.AGENT), false, `agent should not access ${route}`)
    assert.equal(canAccessPath(route, USER_ROLES.TENANT), false, `tenant should not access ${route}`)
  }
})

test('admin role view dashboards remain accessible for admin', () => {
  assert.equal(canAccessPath('/landlord-dashboard', USER_ROLES.ADMIN), true)
  assert.equal(canAccessPath('/agent-dashboard', USER_ROLES.ADMIN), true)
})
