'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuthSession } from '@/contexts/auth-session-context'

const FETCH_THROTTLE_MS = 1200
const FETCH_DEBOUNCE_MS = 400
const FALLBACK_POLL_MS = 90000
const METRICS_STALE_TIME_MS = 45000
const metricsCache = new Map()

const isEqualJSON = (left, right) => {
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

const TABLES_BY_SCOPE = {
  admin: ['profiles', 'plots', 'units', 'payments', 'admin_audit_logs', 'subscription_plans', 'platform_fee_rules', 'landlord_subscriptions'],
  landlord: ['plots', 'units', 'tenants', 'tenancies', 'payments', 'invoices', 'maintenance_requests', 'utility_bills'],
  agent: ['units', 'tenancies', 'maintenance_requests', 'messages', 'bookings', 'viewing_appointments'],
  tenant: ['payments', 'invoices', 'maintenance_requests', 'messages', 'notifications', 'documents', 'units', 'tenants', 'tenancies']
}

const scopeUsesOwnerFilter = scope => ['landlord', 'agent'].includes(scope)

const getCacheKey = (scope, userId) => {
  if (!scope || !userId) {
    return ''
  }

  return `${scope}:${userId}`
}

const readFreshCache = cacheKey => {
  if (!cacheKey) {
    return null
  }

  const entry = metricsCache.get(cacheKey)

  if (!entry) {
    return null
  }

  if (Date.now() - entry.updatedAt > METRICS_STALE_TIME_MS) {
    return null
  }

  return entry
}

export const useRealtimeDashboardMetrics = ({ scope, initialMetrics, initialError = null }) => {
  const { loading, user, supabase } = useAuthSession()
  const cacheKey = useMemo(() => getCacheKey(scope, user?.id), [scope, user?.id])
  const cachedEntry = useMemo(() => readFreshCache(cacheKey), [cacheKey])

  const [metrics, setMetrics] = useState(() => {
    if (cachedEntry?.metrics) {
      return cachedEntry.metrics
    }

    return initialMetrics
  })

  const [refreshError, setRefreshError] = useState(initialError)

  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => {
    if (cachedEntry?.metrics) {
      return cachedEntry.updatedAt
    }

    return initialMetrics ? Date.now() : null
  })

  const [isRefreshing, setIsRefreshing] = useState(false)
  const timerRef = useRef(null)
  const intervalRef = useRef(null)
  const lastFetchRef = useRef(0)
  const abortRef = useRef(null)

  const tables = useMemo(() => TABLES_BY_SCOPE[scope] || [], [scope])

  useEffect(() => {
    const cached = readFreshCache(cacheKey)
    const canUseCache = Boolean(cached?.metrics)

    setMetrics(canUseCache ? cached.metrics : initialMetrics)
    setRefreshError(initialError)
    setLastUpdatedAt(canUseCache ? cached.updatedAt : initialMetrics ? Date.now() : null)
    setIsRefreshing(false)
  }, [cacheKey, initialError, initialMetrics])

  const refreshNow = useCallback(async () => {
    if (!scope) {
      return
    }

    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()

    abortRef.current = controller

    try {
      setIsRefreshing(true)

      const response = await fetch(`/api/dashboard/metrics?scope=${encodeURIComponent(scope)}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      })

      if (!response.ok) {
        let message = 'Unable to refresh dashboard metrics.'

        try {
          const payload = await response.json()

          if (payload?.error) {
            message = payload.error
          }
        } catch {
          // Non-JSON response fallback.
        }

        setRefreshError(message)

        return
      }

      const payload = await response.json()

      if (payload?.metrics) {
        const nextMetrics = payload.metrics
        const updatedAt = Date.now()
        const nextCacheKey = getCacheKey(scope, user?.id)

        if (nextCacheKey) {
          metricsCache.set(nextCacheKey, {
            metrics: nextMetrics,
            updatedAt
          })
        }

        setMetrics(prev => (isEqualJSON(prev, nextMetrics) ? prev : nextMetrics))
        setLastUpdatedAt(updatedAt)
      }

      setRefreshError(prev => (prev === (payload?.error || null) ? prev : payload?.error || null))
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setRefreshError('Network refresh failed. Retrying automatically.')
      }
    } finally {
      setIsRefreshing(false)
      lastFetchRef.current = Date.now()
    }
  }, [scope, user?.id])

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

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      refreshNow()
    }, Math.max(FETCH_DEBOUNCE_MS, FETCH_THROTTLE_MS - elapsed))
  }, [refreshNow])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    if (loading || !supabase || !user?.id || !scope || !tables.length) {
      return undefined
    }

    const channel = supabase.channel(`dashboard-metrics:${scope}:${user.id}`)

    tables.forEach(table => {
      const payload = {
        event: '*',
        schema: 'public',
        table
      }

      if (scopeUsesOwnerFilter(scope)) {
        payload.filter = `owner_id=eq.${user.id}`
      }

      channel.on('postgres_changes', payload, scheduleRefresh)
    })

    channel.subscribe()

    intervalRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      refreshNow()
    }, FALLBACK_POLL_MS)

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      supabase.removeChannel(channel)
    }
  }, [loading, refreshNow, scheduleRefresh, scope, supabase, tables, user?.id])

  useEffect(() => {
    const cached = readFreshCache(cacheKey)

    if (!scope || !cached) {
      refreshNow()

      return
    }

  }, [cacheKey, refreshNow, scope])

  return {
    metrics,
    isRefreshing,
    refreshError,
    refreshNow,
    lastUpdatedAt
  }
}
