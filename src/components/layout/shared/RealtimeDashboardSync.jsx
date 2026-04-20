'use client'

import { useCallback, useEffect, useMemo, useRef, useTransition } from 'react'

import { usePathname, useRouter } from 'next/navigation'

import { USER_ROLES } from '@/libs/auth/roles'
import { useAuthSession } from '@/contexts/auth-session-context'

const REFRESH_THROTTLE_MS = 1200
const REFRESH_DEBOUNCE_MS = 450

const OWNER_SCOPED_BASE_TABLES = [
  'plots',
  'units',
  'tenants',
  'tenancies',
  'payments',
  'invoices',
  'maintenance_requests',
  'messages',
  'documents',
  'report_runs',
  'unit_media',
  'viewing_appointments',
  'bookings',
  'utility_bills',
  'payment_receipts',
  'notifications',
  'maintenance_assignments',
  'landlord_subscriptions',
  'meter_readings',
  'insurance_policies',
  'classifieds_listings'
]

const ADMIN_GLOBAL_TABLES = ['profiles', 'subscription_plans', 'platform_fee_rules', 'admin_audit_logs']

const TABLES_BY_PREFIX = [
  { prefix: '/properties', tables: ['plots', 'units'] },
  { prefix: '/units', tables: ['units', 'plots', 'tenancies'] },
  { prefix: '/tenants', tables: ['tenants', 'payments', 'invoices'] },
  { prefix: '/tenancies', tables: ['tenancies', 'units', 'tenants'] },
  { prefix: '/payments', tables: ['payments', 'invoices', 'payment_receipts'] },
  { prefix: '/invoices', tables: ['invoices', 'payments', 'utility_bills'] },
  { prefix: '/maintenance', tables: ['maintenance_requests', 'maintenance_assignments', 'contractors'] },
  { prefix: '/messaging', tables: ['messages', 'notifications'] },
  { prefix: '/documents', tables: ['documents'] },
  { prefix: '/marketplace', tables: ['units', 'bookings', 'viewing_appointments', 'unit_media'] },
  { prefix: '/reports', tables: ['report_runs', 'payments', 'invoices', 'units', 'tenancies'] },
  { prefix: '/account-settings', tables: ['profiles'] },
  { prefix: '/admin', tables: ['profiles', 'admin_audit_logs', 'subscription_plans', 'platform_fee_rules'] },
  {
    prefix: '/dashboard',
    tables: ['plots', 'units', 'tenants', 'tenancies', 'payments', 'invoices', 'maintenance_requests', 'messages']
  },
  {
    prefix: '/landlord-dashboard',
    tables: ['plots', 'units', 'tenants', 'tenancies', 'payments', 'invoices', 'maintenance_requests']
  },
  { prefix: '/agent-dashboard', tables: ['units', 'tenancies', 'maintenance_requests', 'messages'] },
  { prefix: '/tenant-dashboard', tables: ['payments', 'invoices', 'maintenance_requests', 'units'] },
  { prefix: '/admin-dashboard', tables: ['profiles', 'plots', 'units', 'payments', 'admin_audit_logs'] }
]

const METRICS_STREAMING_PAGES = ['/admin-dashboard', '/landlord-dashboard', '/agent-dashboard', '/tenant-dashboard']

const MODULE_STREAMING_PAGES = [
  '/properties',
  '/units',
  '/tenants',
  '/tenancies',
  '/marketplace',
  '/payments',
  '/invoices',
  '/maintenance',
  '/messaging',
  '/documents',
  '/reports',
  '/admin'
]

const uniq = list => [...new Set(list)]

const getRouteTables = pathname => {
  if (
    METRICS_STREAMING_PAGES.some(route => pathname === route || pathname.startsWith(`${route}/`)) ||
    MODULE_STREAMING_PAGES.some(route => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return []
  }

  const matched = TABLES_BY_PREFIX.filter(item => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`))

  if (!matched.length) {
    return OWNER_SCOPED_BASE_TABLES
  }

  return uniq(matched.flatMap(item => item.tables))
}

const RealtimeDashboardSync = () => {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const timerRef = useRef(null)
  const lastRefreshRef = useRef(0)
  const { loading, user, role, supabase } = useAuthSession()

  const isAdmin = role === USER_ROLES.ADMIN
  const useOwnerFilter = role === USER_ROLES.LANDLORD || role === USER_ROLES.AGENT

  const tableConfigs = useMemo(() => {
    const routeTables = getRouteTables(pathname || '/dashboard')
    const routeScopedTables = routeTables.filter(table => OWNER_SCOPED_BASE_TABLES.includes(table))
    const ownerFilter = user?.id && useOwnerFilter ? `owner_id=eq.${user.id}` : null
    const ownerScoped = routeScopedTables.map(table => ({ table, filter: ownerFilter }))

    const adminScoped = isAdmin
      ? ADMIN_GLOBAL_TABLES.filter(table => routeTables.includes(table)).map(table => ({ table, filter: null }))
      : []

    return uniq([...ownerScoped, ...adminScoped].map(item => `${item.table}:${item.filter || ''}`)).map(key => {
      const [table, filter] = key.split(':')

      return {
        table,
        filter: filter || null
      }
    })
  }, [isAdmin, pathname, useOwnerFilter, user?.id])

  const runRefresh = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    lastRefreshRef.current = Date.now()
    startTransition(() => {
      router.refresh()
    })
  }, [router, startTransition])

  const scheduleRefresh = useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastRefreshRef.current

    if (elapsed >= REFRESH_THROTTLE_MS) {
      runRefresh()

      return
    }

    if (timerRef.current) {
      return
    }

    const wait = Math.max(REFRESH_DEBOUNCE_MS, REFRESH_THROTTLE_MS - elapsed)

    timerRef.current = setTimeout(() => {
      runRefresh()
    }, wait)
  }, [runRefresh])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (loading || !supabase || !user?.id) {
      return undefined
    }

    if (!tableConfigs.length) {
      return undefined
    }

    const channel = supabase.channel(`dashboard-sync:${user.id}:${role || 'unknown'}`)

    tableConfigs.forEach(config => {
      const payload = {
        event: '*',
        schema: 'public',
        table: config.table
      }

      if (config.filter) {
        payload.filter = config.filter
      }

      channel.on('postgres_changes', payload, scheduleRefresh)
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loading, role, scheduleRefresh, supabase, tableConfigs, user?.id])

  return null
}

export default RealtimeDashboardSync
