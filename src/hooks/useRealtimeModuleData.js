'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuthSession } from '@/contexts/auth-session-context'

const FETCH_THROTTLE_MS = 1200
const FETCH_DEBOUNCE_MS = 350

const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: 20,
  totalRows: 0,
  totalPages: 1
}

const TABLES_BY_MODULE = {
  properties: ['plots', 'units'],
  units: ['units', 'plots', 'tenancies'],
  tenants: ['tenants', 'payments', 'invoices'],
  tenancies: ['tenancies', 'units', 'tenants'],
  marketplace: ['units', 'bookings', 'viewing_appointments', 'unit_media'],
  payments: ['payments', 'invoices', 'payment_receipts'],
  paymentsMonitoring: ['payments', 'payment_provider_events', 'payment_receipts', 'invoices'],
  landlordLeads: ['profiles'],
  onboardingPipeline: ['landlord_subscriptions', 'profiles'],
  invoices: ['invoices', 'payments', 'utility_bills'],
  maintenance: ['maintenance_requests', 'maintenance_assignments', 'contractors'],
  messaging: ['messages', 'notifications'],
  documents: ['documents'],
  reports: ['report_runs', 'payments', 'invoices', 'units', 'tenancies'],
  subscriptions: ['landlord_subscriptions', 'subscription_plans'],
  fees: ['platform_fee_rules'],
  users: ['profiles'],
  admin: ['admin_audit_logs', 'profiles', 'subscription_plans', 'platform_fee_rules']
}

const UNFILTERED_TABLES = new Set(['profiles', 'subscription_plans', 'platform_fee_rules'])
const roleUsesOwnerFilter = role => ['landlord', 'agent'].includes(role)

const shallowEqual = (left, right) => {
  if (left === right) {
    return true
  }

  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false
  }

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every(key => left[key] === right[key])
}

const getRowIdentity = row => {
  if (!row || typeof row !== 'object') {
    return row
  }

  return row.id ?? row.plotId ?? row.unitId ?? row.receiptNo ?? row.invoiceNo ?? row.ticket ?? row.docId ?? row.thread ?? row.report
}

const areArraysEquivalent = (left, right) => {
  if (left === right) {
    return true
  }

  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false
  }

  return left.every((entry, index) => {
    const leftIdentity = getRowIdentity(entry)
    const rightIdentity = getRowIdentity(right[index])

    if (leftIdentity !== undefined || rightIdentity !== undefined) {
      return leftIdentity === rightIdentity
    }

    return shallowEqual(entry, right[index])
  })
}

export const useRealtimeModuleData = ({
  moduleKey,
  initialRows,
  initialStats,
  initialDataSource,
  initialWarning = '',
  initialPagination = DEFAULT_PAGINATION,
  queryParams = {},
  includeStats = true
}) => {
  const [rows, setRows] = useState(initialRows)
  const [stats, setStats] = useState(initialStats)
  const [dataSource, setDataSource] = useState(initialDataSource)
  const [pagination, setPagination] = useState(initialPagination)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState(initialWarning)
  const timerRef = useRef(null)
  const lastFetchRef = useRef(0)
  const abortRef = useRef(null)
  const { loading, role, user, supabase } = useAuthSession()

  const tables = useMemo(() => TABLES_BY_MODULE[moduleKey] || [], [moduleKey])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()

    if (includeStats) {
      params.set('includeStats', 'true')
    }

    Object.entries(queryParams || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, value]) => {
        const normalized = String(value ?? '').trim()

        if (!normalized) {
          return
        }

        params.set(key, normalized)
      })

    return params.toString()
  }, [includeStats, queryParams])

  const requestUrl = useMemo(() => {
    if (!moduleKey) {
      return ''
    }

    if (!queryString) {
      return `/api/modules/${moduleKey}`
    }

    return `/api/modules/${moduleKey}?${queryString}`
  }, [moduleKey, queryString])

  useEffect(() => {
    setRows(initialRows)
    setStats(initialStats)
    setDataSource(initialDataSource)
    setPagination(prev => (shallowEqual(prev, initialPagination) ? prev : initialPagination))
    setWarning(String(initialWarning || ''))
  }, [initialDataSource, initialRows, initialStats, initialPagination, initialWarning])

  const refreshNow = useCallback(async () => {
    if (!requestUrl) {
      return
    }

    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()

    abortRef.current = controller

    try {
      setIsRefreshing(true)

      const response = await fetch(requestUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMessage = payload?.error || `Request failed with status ${response.status}.`

        setError(String(errorMessage || 'Unable to load live data.'))
        setWarning(String(payload?.warning || ''))

        return
      }

      if (payload?.success === false) {
        const errorMessage = payload?.error || 'Unable to load live data.'

        setError(String(errorMessage || 'Unable to load live data.'))
      } else {
        setError('')
      }

      if (payload?.warning) {
        setWarning(String(payload.warning))
      } else {
        setWarning('')
      }

      if (Array.isArray(payload?.rows)) {
        setRows(prev => (areArraysEquivalent(prev, payload.rows) ? prev : payload.rows))
      }

      if (Array.isArray(payload?.stats)) {
        setStats(prev => (areArraysEquivalent(prev, payload.stats) ? prev : payload.stats))
      }

      if (typeof payload?.dataSource === 'string') {
        setDataSource(prev => (prev === payload.dataSource ? prev : payload.dataSource))
      }

      if (payload?.pagination && typeof payload.pagination === 'object') {
        setPagination(prev => {
          const next = {
            page: Number(payload.pagination?.page) || 1,
            pageSize: Number(payload.pagination?.pageSize) || 20,
            totalRows: Number(payload.pagination?.totalRows) || 0,
            totalPages: Number(payload.pagination?.totalPages) || 1
          }

          return shallowEqual(prev, next) ? prev : next
        })
      }
    } catch {
      // Ignore transient fetch errors. Next realtime event or manual refresh retries.
      setError(prev => prev || 'Unable to reach live data service.')
    } finally {
      setIsRefreshing(false)
      lastFetchRef.current = Date.now()
    }
  }, [requestUrl])

  const scheduleRefresh = useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastFetchRef.current

    if (elapsed >= FETCH_THROTTLE_MS) {
      refreshNow()

      return
    }

    if (timerRef.current) {
      return
    }

    const wait = Math.max(FETCH_DEBOUNCE_MS, FETCH_THROTTLE_MS - elapsed)

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      refreshNow()
    }, wait)
  }, [refreshNow])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    if (loading || !supabase || !user?.id || !moduleKey || !tables.length) {
      return undefined
    }

    const channel = supabase.channel(`module-data:${moduleKey}:${user.id}`)

    tables.forEach(table => {
      const payload = {
        event: '*',
        schema: 'public',
        table
      }

      if (!UNFILTERED_TABLES.has(table) && roleUsesOwnerFilter(role)) {
        payload.filter = `owner_id=eq.${user.id}`
      }

      channel.on('postgres_changes', payload, scheduleRefresh)
    })

    channel.subscribe()

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      supabase.removeChannel(channel)
    }
  }, [loading, moduleKey, role, scheduleRefresh, supabase, tables, user?.id])

  useEffect(() => {
    refreshNow()
  }, [refreshNow])

  return {
    rows,
    stats,
    dataSource,
    pagination,
    isRefreshing,
    error,
    warning,
    refreshNow
  }
}
