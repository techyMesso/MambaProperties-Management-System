'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_STALE_TIME = 45_000
const DEFAULT_REFETCH_INTERVAL = 90_000

const DEFAULT_DATA = {
  rows: [],
  stats: [],
  dataSource: 'sample',
  pagination: {
    page: 1,
    pageSize: 20,
    totalRows: 0,
    totalPages: 1
  }
}

const moduleListCache = new Map()

const stableStringify = value => {
  if (!value || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  const sorted = Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = value[key]

      return acc
    }, {})

  return JSON.stringify(sorted)
}

const buildQueryString = ({ page, pageSize, search, includeStats, filters }) => {
  const params = new URLSearchParams()

  params.set('page', String(page))
  params.set('pageSize', String(pageSize))

  if (search) {
    params.set('search', String(search))
  }

  if (includeStats) {
    params.set('includeStats', 'true')
  }

  Object.entries(filters || {}).forEach(([key, value]) => {
    const normalized = String(value ?? '').trim()

    if (!normalized || normalized.toLowerCase() === 'all') {
      return
    }

    params.set(key, normalized)
  })

  return params.toString()
}

export const useModuleListQuery = ({
  moduleKey,
  page = 1,
  pageSize = 20,
  search = '',
  filters = {},
  includeStats = false,
  initialData = DEFAULT_DATA,
  staleTime = DEFAULT_STALE_TIME,
  refetchInterval = DEFAULT_REFETCH_INTERVAL
}) => {
  const [data, setData] = useState(initialData || DEFAULT_DATA)
  const [isLoading, setIsLoading] = useState(!initialData?.rows?.length)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)

  const queryKey = useMemo(
    () => `${moduleKey}:${page}:${pageSize}:${search || ''}:${includeStats ? '1' : '0'}:${stableStringify(filters)}`,
    [filters, includeStats, moduleKey, page, pageSize, search]
  )

  const requestUrl = useMemo(() => {
    const query = buildQueryString({ page, pageSize, search, includeStats, filters })

    return `/api/modules/${moduleKey}?${query}`
  }, [filters, includeStats, moduleKey, page, pageSize, search])

  const runFetch = useCallback(
    async ({ background = false } = {}) => {
      if (!moduleKey) {
        return
      }

      if (abortRef.current) {
        abortRef.current.abort()
      }

      const controller = new AbortController()

      abortRef.current = controller

      if (background) {
        setIsFetching(true)
      } else {
        setIsLoading(true)
      }

      try {
        const response = await fetch(requestUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          setError(payload?.error || 'Unable to load module records.')

          return
        }

        const nextData = {
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          stats: Array.isArray(payload?.stats) ? payload.stats : [],
          dataSource: payload?.dataSource || 'live',
          pagination: payload?.pagination || DEFAULT_DATA.pagination
        }

        moduleListCache.set(queryKey, {
          data: nextData,
          updatedAt: Date.now()
        })

        setData(nextData)
        setError('')
      } catch (fetchError) {
        if (fetchError?.name !== 'AbortError') {
          setError('Network refresh failed. Retrying in background.')
        }
      } finally {
        setIsLoading(false)
        setIsFetching(false)
      }
    },
    [moduleKey, queryKey, requestUrl]
  )

  useEffect(() => {
    const cached = moduleListCache.get(queryKey)

    if (cached?.data) {
      setData(cached.data)
      setError('')
      setIsLoading(false)

      if (Date.now() - cached.updatedAt <= staleTime) {
        return undefined
      }

      runFetch({ background: true })

      return undefined
    }

    runFetch()

    return undefined
  }, [queryKey, runFetch, staleTime])

  useEffect(() => {
    if (!refetchInterval || refetchInterval < 1_000) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      runFetch({ background: true })
    }, refetchInterval)

    return () => {
      window.clearInterval(timerId)
    }
  }, [refetchInterval, runFetch])

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [])

  return {
    data,
    rows: data.rows || [],
    stats: data.stats || [],
    dataSource: data.dataSource || 'sample',
    pagination: data.pagination || DEFAULT_DATA.pagination,
    isLoading,
    isFetching,
    error,
    refetch: () => runFetch({ background: true })
  }
}
