'use client'

import { useEffect } from 'react'

import { usePathname, useRouter } from 'next/navigation'

import { canAccessPath, USER_ROLES } from '@/libs/auth/roles'
import { useAuthSession } from '@/contexts/auth-session-context'

const CANDIDATE_ROUTES = [
  '/dashboard',
  '/admin-dashboard',
  '/landlord-leads',
  '/onboarding-pipeline',
  '/landlord-dashboard',
  '/agent-dashboard',
  '/tenant-dashboard',
  '/landlord-verification',
  '/subscriptions-plans',
  '/fees-commissions',
  '/income-analytics',
  '/user-management',
  '/payments-monitoring',
  '/audit-security',
  '/documents-review',
  '/system-settings',
  '/properties',
  '/units',
  '/tenants',
  '/tenancies',
  '/marketplace',
  '/payments',
  '/invoices',
  '/reports',
  '/maintenance',
  '/messaging',
  '/documents',
  '/account-settings',
  '/admin',
  '/admin/migrations'
]

const ROLE_PREFETCH_ROUTES = {
  [USER_ROLES.ADMIN]: [
    '/admin-dashboard',
    '/landlord-leads',
    '/onboarding-pipeline',
    '/landlord-verification',
    '/subscriptions-plans',
    '/fees-commissions',
    '/income-analytics',
    '/user-management',
    '/payments-monitoring',
    '/audit-security',
    '/reports',
    '/documents-review',
    '/system-settings',
    '/admin/migrations'
  ],
  [USER_ROLES.LANDLORD]: ['/landlord-dashboard', '/properties', '/marketplace', '/payments', '/invoices'],
  [USER_ROLES.AGENT]: ['/agent-dashboard', '/marketplace', '/tenancies', '/maintenance', '/messaging'],
  [USER_ROLES.TENANT]: ['/tenant-dashboard', '/marketplace', '/payments', '/invoices', '/maintenance']
}

const DashboardRoutePrefetch = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { loading, role } = useAuthSession()

  useEffect(() => {
    if (loading || !role) {
      return undefined
    }

    const connection =
      typeof navigator !== 'undefined' && 'connection' in navigator && navigator.connection ? navigator.connection : null

    const isConstrainedNetwork = Boolean(connection?.saveData || /2g/.test(String(connection?.effectiveType || '')))
    const isSmallScreen = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false

    if (isConstrainedNetwork) {
      return undefined
    }

    const roleRoutes = ROLE_PREFETCH_ROUTES[role] || CANDIDATE_ROUTES
    const maxPrefetch = isSmallScreen ? 2 : 5
    const routesToPrefetch = roleRoutes.filter(route => route !== pathname && canAccessPath(route, role)).slice(0, maxPrefetch)
    let idleId
    let timerId

    const prefetchAll = () => {
      routesToPrefetch.forEach(route => router.prefetch(route))
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(prefetchAll, { timeout: 2000 })
    } else {
      timerId = window.setTimeout(prefetchAll, 120)
    }

    return () => {
      if (typeof idleId === 'number') {
        window.cancelIdleCallback(idleId)
      }

      if (typeof timerId === 'number') {
        window.clearTimeout(timerId)
      }
    }
  }, [loading, pathname, role, router])

  return null
}

export default DashboardRoutePrefetch
