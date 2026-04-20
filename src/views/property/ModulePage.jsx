'use client'

// React Imports
import { useEffect, useMemo, useState } from 'react'

// Utils Imports
import { DEFAULT_PAGE_SIZE } from '@/libs/constants'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// MUI Imports
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

// Styles Imports
import tableStyles from '@core/styles/table.module.css'
import { useAuthSession } from '@/contexts/auth-session-context'
import { useRealtimeModuleData } from '@/hooks/useRealtimeModuleData'

const getChipColor = value => {
  const normalized = String(value).toLowerCase()

  if (
    normalized.includes('paid') ||
    normalized.includes('completed') ||
    normalized.includes('vacant') ||
    normalized.includes('active')
  ) {
    return 'success'
  }

  if (
    normalized.includes('pending') ||
    normalized.includes('partial') ||
    normalized.includes('in progress') ||
    normalized.includes('due')
  ) {
    return 'warning'
  }

  if (
    normalized.includes('arrears') ||
    normalized.includes('overdue') ||
    normalized.includes('cancelled') ||
    normalized.includes('blocked')
  ) {
    return 'error'
  }

  if (normalized.includes('occupied') || normalized.includes('scheduled') || normalized.includes('open')) {
    return 'info'
  }

  return 'secondary'
}

const isChipField = key => {
  const normalized = key.toLowerCase()

  return normalized.includes('status') || normalized.includes('availability') || normalized.includes('stage')
}

const isFileValue = value => typeof File !== 'undefined' && value instanceof File

const hasFieldValue = value => {
  if (isFileValue(value)) {
    return value.size > 0
  }

  return Boolean(String(value ?? '').trim())
}

const isDocumentPathField = key => key.toLowerCase().includes('filepath')

const isStoredDocumentPath = value => {
  const normalized = String(value ?? '').trim()

  return normalized.includes('/')
}

const initialFormValues = createFields =>
  createFields.reduce((acc, field) => {
    acc[field.name] = field.type === 'file' ? null : ''

    return acc
  }, {})

const toDateTimeLocal = value => {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString().slice(0, 16)
}

const nowPlusHours = hours => toDateTimeLocal(Date.now() + hours * 60 * 60 * 1000)

const getMarketplaceDialogTitle = action => {
  if (action === 'viewing') {
    return 'Request Viewing'
  }

  if (action === 'booking') {
    return 'Book Unit'
  }

  return 'Send Inquiry'
}

// DEFAULT_PAGE_SIZE imported from constants

const QUERYABLE_MODULES = new Set([
  'properties',
  'units',
  'tenants',
  'tenancies',
  'payments',
  'paymentsMonitoring',
  'landlordLeads',
  'invoices',
  'documents',
  'users',
  'admin'
])

const MODULE_FILTER_FIELDS = {
  properties: [
    {
      key: 'status',
      label: 'Status',
      options: ['all', 'vacant', 'occupied']
    }
  ],
  units: [
    {
      key: 'status',
      label: 'Status',
      options: ['all', 'vacant', 'occupied']
    },
    {
      key: 'category',
      label: 'Category',
      options: ['all', 'Bedsitter', '1BR', '2BR', '3BR', 'Shop', 'Office']
    }
  ],
  tenants: [
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      options: ['all', 'paid', 'partial', 'pending', 'arrears']
    }
  ],
  tenancies: [
    {
      key: 'status',
      label: 'Tenancy Status',
      options: ['all', 'active', 'pending', 'move-out scheduled']
    }
  ],
  payments: [
    {
      key: 'status',
      label: 'Payment Status',
      options: ['all', 'paid', 'partial', 'pending', 'arrears', 'failed']
    },
    {
      key: 'channel',
      label: 'Channel',
      options: ['all', 'M-Pesa STK', 'Paybill', 'Bank Transfer', 'Card', 'Cash']
    }
  ],
  paymentsMonitoring: [
    {
      key: 'status',
      label: 'Payment Status',
      options: ['all', 'paid', 'partial', 'pending', 'arrears', 'failed']
    },
    {
      key: 'channel',
      label: 'Channel',
      options: ['all', 'M-Pesa STK', 'Paybill', 'Bank Transfer', 'Card', 'Cash']
    }
  ],
  landlordLeads: [
    {
      key: 'role',
      label: 'Role',
      options: ['all', 'landlord', 'tenant', 'agent', 'admin']
    },
    {
      key: 'requestedRole',
      label: 'Requested Role',
      options: ['all', 'landlord', 'tenant', 'agent', 'admin']
    }
  ],
  onboardingPipeline: [
    {
      key: 'status',
      label: 'Status',
      options: ['all', 'active', 'trial', 'pending', 'rejected', 'inactive']
    }
  ],
  invoices: [
    {
      key: 'status',
      label: 'Invoice Status',
      options: ['all', 'paid', 'partial', 'pending', 'overdue']
    }
  ],
  documents: [
    {
      key: 'status',
      label: 'Doc Status',
      options: ['all', 'active', 'pending review', 'approved', 'rejected', 'archived']
    },
    {
      key: 'type',
      label: 'Doc Type',
      options: ['all', 'Tenant Payment Proof', 'Tenancy Agreement', 'Ownership Certificate', 'Maintenance Report']
    }
  ],
  users: [
    {
      key: 'role',
      label: 'Role',
      options: ['all', 'admin', 'landlord', 'agent', 'tenant']
    },
    {
      key: 'requestedRole',
      label: 'Requested Role',
      options: ['all', 'pending', 'admin', 'landlord', 'agent', 'tenant']
    }
  ],
  admin: [
    {
      key: 'status',
      label: 'Audit Status',
      options: ['all', 'pending', 'blocked', 'completed']
    },
    {
      key: 'action',
      label: 'Action',
      options: ['all', 'Role Approval', 'KYC Verification', 'Plan Upgrade', 'Suspension Review']
    }
  ]
}

const getTenantTitle = (moduleKey, fallbackTitle) => {
  if (moduleKey === 'payments') {
    return 'My Rent Payments'
  }

  if (moduleKey === 'invoices') {
    return 'My Invoices & Receipts'
  }

  if (moduleKey === 'marketplace') {
    return 'Find & Book a Home'
  }

  return fallbackTitle
}

const getTenantDescription = (moduleKey, fallbackDescription) => {
  if (moduleKey === 'payments') {
    return 'Track your rent payments, pending balances, and payment confirmations.'
  }

  if (moduleKey === 'invoices') {
    return 'View your invoices, receipts, and overdue balances only.'
  }

  if (moduleKey === 'marketplace') {
    return 'Search available listings, save houses, request viewings, and submit booking requests.'
  }

  return fallbackDescription
}

const withTenantStatCopy = (moduleKey, stats) => {
  const copy = {
    payments: [
      { label: 'Paid Amount', hint: 'Paid and partial transactions' },
      { label: 'Pending Balance', hint: 'Pending or partial balances' },
      { label: 'Overdue Balance', hint: 'Arrears and overdue balances' },
      { label: 'My Payment Records', hint: 'Visible to your account' }
    ],
    invoices: [
      { label: 'My Invoices', hint: 'Invoices in your account' },
      { label: 'Paid Invoices', hint: 'Marked paid' },
      { label: 'Overdue Invoices', hint: 'Require follow-up' },
      { label: 'Invoices With Activity', hint: 'Paid or partial status' }
    ],
    marketplace: [
      { label: 'Available Listings', hint: 'Vacant listings you can browse' },
      { label: 'Viewing Ready', hint: 'Listings open for viewing' },
      { label: 'Booking Stage Listings', hint: 'Listings in pending/booked stage' },
      { label: 'Booking Fees (My Requests)', hint: 'Account-scoped booking totals' }
    ]
  }[moduleKey]

  if (!copy) {
    return stats
  }

  return stats.map((item, index) => ({
    ...item,
    label: copy[index]?.label || item.label,
    hint: copy[index]?.hint || item.hint
  }))
}

const ModulePage = ({
  moduleKey,
  title,
  description,
  stats,
  columns,
  rows,
  primaryActionLabel,
  createFields = [],
  createEnabled = true,
  dataSource = 'sample',
  warning = ''
}) => {
  const { role } = useAuthSession()
  const canQuery = QUERYABLE_MODULES.has(moduleKey)
  const filterFields = MODULE_FILTER_FIELDS[moduleKey] || []
  const searchParams = useSearchParams()
  const searchParamsKey = searchParams?.toString() || ''
  const savedOnlyRequested = searchParams?.get('saved') === '1'
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [formValues, setFormValues] = useState(initialFormValues(createFields))
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openMarketplaceDialog, setOpenMarketplaceDialog] = useState(false)
  const [marketplaceAction, setMarketplaceAction] = useState('viewing')
  const [selectedListing, setSelectedListing] = useState(null)

  const [roleDecisionDialog, setRoleDecisionDialog] = useState({
    open: false,
    record: null,
    decision: 'approve',
    notes: ''
  })

  const [roleDecisionError, setRoleDecisionError] = useState('')
  const [roleDecisionSuccess, setRoleDecisionSuccess] = useState('')

  const [marketplaceForm, setMarketplaceForm] = useState({
    preferredTime: nowPlusHours(24),
    notes: '',
    bookingFee: '',
    expiresAt: nowPlusHours(72)
  })

  const [marketplaceError, setMarketplaceError] = useState('')
  const [marketplaceSuccess, setMarketplaceSuccess] = useState('')
  const [isMarketplaceSubmitting, setIsMarketplaceSubmitting] = useState(false)
  const [favoriteUnitIds, setFavoriteUnitIds] = useState([])
  const [favoritesError, setFavoritesError] = useState('')
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(false)
  const [favoriteActionUnitId, setFavoriteActionUnitId] = useState('')

  const initialTableQuery = useMemo(() => {
    const params = new URLSearchParams(searchParamsKey)

    const next = {
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      search: ''
    }

    if (!params.toString()) {
      return next
    }

    params.forEach((value, key) => {
      const normalized = String(value || '').trim()

      if (!normalized) {
        return
      }

      if (key === 'page') {
        const parsedPage = Number(normalized)

        next.page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1

        return
      }

      if (key === 'pageSize') {
        const parsedPageSize = Number(normalized)

        next.pageSize =
          Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.floor(parsedPageSize) : DEFAULT_PAGE_SIZE

        return
      }

      if (key === 'search') {
        next.search = normalized

        return
      }

      next[key] = normalized
    })

    return next
  }, [searchParamsKey])

  const [tableQuery, setTableQuery] = useState(initialTableQuery)
  const [searchDraft, setSearchDraft] = useState(initialTableQuery.search || '')

  useEffect(() => {
    setTableQuery(prev => (JSON.stringify(prev) === JSON.stringify(initialTableQuery) ? prev : initialTableQuery))
    setSearchDraft(prev => (prev === (initialTableQuery.search || '') ? prev : initialTableQuery.search || ''))
  }, [initialTableQuery, moduleKey])

  const moduleQueryParams = useMemo(() => {
    if (!canQuery) {
      return {}
    }

    const next = {}

    Object.entries(tableQuery || {}).forEach(([key, value]) => {
      const normalized = String(value ?? '').trim()

      if (!normalized || normalized.toLowerCase() === 'all') {
        return
      }

      next[key] = normalized
    })

    if (!next.page) {
      next.page = String(tableQuery?.page || 1)
    }

    if (!next.pageSize) {
      next.pageSize = String(tableQuery?.pageSize || DEFAULT_PAGE_SIZE)
    }

    return next
  }, [canQuery, tableQuery])

  const activeFilterEntries = useMemo(
    () =>
      Object.entries(moduleQueryParams).filter(
        ([key]) => !['page', 'pageSize', 'includeStats', 'search'].includes(key)
      ),
    [moduleQueryParams]
  )

  const {
    rows: liveRows,
    stats: liveStats,
    dataSource: liveSource,
    pagination,
    isRefreshing,
    error: moduleError,
    warning: moduleWarning,
    refreshNow
  } = useRealtimeModuleData({
    moduleKey,
    initialRows: rows,
    initialStats: stats,
    initialDataSource: dataSource,
    initialWarning: warning,
    queryParams: moduleQueryParams,
    includeStats: true
  })

  const currentPage = Number(tableQuery?.page) || 1
  const totalPages = Math.max(1, Number(pagination?.totalPages) || 1)
  const totalRows = Number.isFinite(Number(pagination?.totalRows)) ? Number(pagination.totalRows) : liveRows.length
  const currentPageSize = Number(tableQuery?.pageSize) || DEFAULT_PAGE_SIZE

  useEffect(() => {
    if (!canQuery) {
      return
    }

    if (currentPage <= totalPages) {
      return
    }

    setTableQuery(prev => ({
      ...prev,
      page: totalPages
    }))
  }, [canQuery, currentPage, totalPages])

  const canCreate = createEnabled && createFields.length > 0
  const isTenantView = role === 'tenant'
  const isTenantMarketplace = moduleKey === 'marketplace' && role === 'tenant'
  const canUseMarketplaceActions = isTenantMarketplace && liveSource === 'live'
  const canUseUserActions = moduleKey === 'users' && role === 'admin'
  const hasActionsColumn = canUseMarketplaceActions || canUseUserActions

  const displayTitle = useMemo(
    () => (isTenantView ? getTenantTitle(moduleKey, title) : title),
    [isTenantView, moduleKey, title]
  )

  const displayDescription = useMemo(
    () => (isTenantView ? getTenantDescription(moduleKey, description) : description),
    [description, isTenantView, moduleKey]
  )

  const favoriteUnitIdSet = useMemo(() => new Set(favoriteUnitIds.map(value => String(value || '').trim()).filter(Boolean)), [favoriteUnitIds])

  const displayStats = useMemo(
    () => (isTenantView ? withTenantStatCopy(moduleKey, liveStats) : liveStats),
    [isTenantView, liveStats, moduleKey]
  )

  const displayColumns = useMemo(() => {
    if (!isTenantView) {
      return columns
    }

    if (moduleKey === 'payments' || moduleKey === 'invoices') {
      return columns.filter(column => column.key !== 'tenant')
    }

    return columns
  }, [columns, isTenantView, moduleKey])

  const visibleRows = useMemo(() => {
    if (!isTenantMarketplace) {
      return liveRows
    }

    const rowsWithSavedState = (liveRows || []).map(row => ({
      ...row,
      isSaved: favoriteUnitIdSet.has(String(row?.unitDbId || '').trim())
    }))

    if (!savedOnlyRequested) {
      return rowsWithSavedState
    }

    return rowsWithSavedState.filter(row => row.isSaved)
  }, [favoriteUnitIdSet, isTenantMarketplace, liveRows, savedOnlyRequested])

  const tableColumnCount = displayColumns.length + (hasActionsColumn ? 1 : 0)

  const sourceLabel = useMemo(() => {
    if (isRefreshing) {
      return 'Syncing...'
    }

    return liveSource === 'live' ? 'Live Data' : 'Sample Data'
  }, [isRefreshing, liveSource])

  const sourceColor = isRefreshing ? 'info' : liveSource === 'live' ? 'success' : 'warning'

  const scopeLabel = useMemo(() => {
    if (role === 'admin') {
      return 'Platform scope'
    }

    if (role === 'tenant') {
      return 'My account'
    }

    return 'Account scope'
  }, [role])

  const quickActions = useMemo(() => {
    if (role !== 'admin' || moduleKey !== 'admin') {
      return []
    }

    return [
      {
        label: 'Landlord Verification',
        href: '/landlord-verification',
        icon: 'ri-user-search-line'
      },
      {
        label: 'Audit Logs',
        href: '/audit-security?status=pending',
        icon: 'ri-shield-check-line'
      }
    ]
  }, [moduleKey, role])

  useEffect(() => {
    if (!isTenantMarketplace || liveSource !== 'live') {
      setFavoriteUnitIds([])
      setFavoritesError('')
      setIsFavoritesLoading(false)

      return
    }

    let isActive = true

    const loadFavorites = async () => {
      try {
        setIsFavoritesLoading(true)
        setFavoritesError('')

        const response = await fetch('/api/tenant/favorites', {
          method: 'GET',
          cache: 'no-store'
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load saved houses.')
        }

        if (!isActive) {
          return
        }

        setFavoriteUnitIds((payload?.favorites || []).map(item => String(item?.unitId || '').trim()).filter(Boolean))
      } catch (error) {
        if (!isActive) {
          return
        }

        setFavoritesError(error?.message || 'Unable to load saved houses.')
      } finally {
        if (isActive) {
          setIsFavoritesLoading(false)
        }
      }
    }

    loadFavorites()

    return () => {
      isActive = false
    }
  }, [isTenantMarketplace, liveSource])

  const showMigrationLink = useMemo(() => {
    if (moduleKey !== 'admin') {
      return false
    }

    const normalized = `${moduleWarning || ''} ${moduleError || ''}`.toLowerCase()

    return normalized.includes('migration') || normalized.includes('schema')
  }, [moduleError, moduleKey, moduleWarning])

  const handleOpenCreate = () => {
    if (!canCreate) {
      return
    }

    setFormValues(initialFormValues(createFields))
    setFormError('')
    setOpenCreateDialog(true)
  }

  const handleFieldChange = (name, value) => {
    setFormValues(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const applySearch = () => {
    if (!canQuery) {
      return
    }

    setTableQuery(prev => ({
      ...prev,
      search: String(searchDraft || '').trim(),
      page: 1
    }))
  }

  const clearSearchAndFilters = () => {
    if (!canQuery) {
      return
    }

    setSearchDraft('')
    setTableQuery(prev => ({
      page: 1,
      pageSize: prev.pageSize || DEFAULT_PAGE_SIZE,
      search: ''
    }))
  }

  const handleFilterChange = (key, value) => {
    if (!canQuery) {
      return
    }

    setTableQuery(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }))
  }

  const handlePageSizeChange = value => {
    const parsed = Number(value)

    if (!Number.isFinite(parsed) || parsed < 1) {
      return
    }

    setTableQuery(prev => ({
      ...prev,
      pageSize: parsed,
      page: 1
    }))
  }

  const goToPage = nextPage => {
    if (!canQuery) {
      return
    }

    setTableQuery(prev => ({
      ...prev,
      page: Math.max(1, Math.min(totalPages, nextPage))
    }))
  }

  const handleMarketplaceFormChange = (name, value) => {
    setMarketplaceForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleOpenMarketplaceAction = (action, row) => {
    setMarketplaceAction(action)
    setSelectedListing(row)
    setMarketplaceError('')
    setMarketplaceSuccess('')
    setMarketplaceForm({
      preferredTime: nowPlusHours(24),
      notes: '',
      bookingFee: '',
      expiresAt: nowPlusHours(72)
    })
    setOpenMarketplaceDialog(true)
  }

  const handleSubmitMarketplaceAction = async () => {
    if (!selectedListing?.unitDbId || !selectedListing?.ownerId) {
      setMarketplaceError('This listing cannot be requested because its IDs are missing.')

      return
    }

    if (marketplaceAction === 'viewing' && !String(marketplaceForm.preferredTime || '').trim()) {
      setMarketplaceError('Preferred viewing time is required.')

      return
    }

    if (marketplaceAction === 'inquiry' && !String(marketplaceForm.notes || '').trim()) {
      setMarketplaceError('Add a short message for the landlord before sending the inquiry.')

      return
    }

    setMarketplaceError('')
    setIsMarketplaceSubmitting(true)

    try {
      const payload = {
        action: marketplaceAction,
        unitId: selectedListing.unitDbId,
        ownerId: selectedListing.ownerId,
        notes: String(marketplaceForm.notes || '').trim() || null
      }

      if (marketplaceAction === 'viewing') {
        payload.preferredTime = marketplaceForm.preferredTime
      } else if (marketplaceAction === 'booking') {
        if (String(marketplaceForm.bookingFee || '').trim()) {
          payload.bookingFee = marketplaceForm.bookingFee
        }

        if (String(marketplaceForm.expiresAt || '').trim()) {
          payload.expiresAt = marketplaceForm.expiresAt
        }
      }

      const response = await fetch('/api/marketplace/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(body?.error || 'Unable to submit request.')
      }

      setMarketplaceSuccess(body?.message || 'Marketplace request submitted.')
      setOpenMarketplaceDialog(false)
      await refreshNow()
    } catch (error) {
      setMarketplaceError(error?.message || 'Unable to submit request.')
    } finally {
      setIsMarketplaceSubmitting(false)
    }
  }

  const handleToggleFavorite = async row => {
    const unitId = String(row?.unitDbId || '').trim()
    const ownerId = String(row?.ownerId || '').trim()

    if (!unitId || !ownerId) {
      setFavoritesError('This listing cannot be saved because its IDs are missing.')

      return
    }

    const isSaved = favoriteUnitIdSet.has(unitId)

    setFavoriteActionUnitId(unitId)
    setFavoritesError('')
    setMarketplaceSuccess('')

    try {
      const response = await fetch(isSaved ? `/api/tenant/favorites/${encodeURIComponent(unitId)}` : '/api/tenant/favorites', {
        method: isSaved ? 'DELETE' : 'POST',
        headers: isSaved
          ? undefined
          : {
              'Content-Type': 'application/json'
            },
        body: isSaved
          ? undefined
          : JSON.stringify({
              unitId,
              ownerId
            })
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(body?.error || 'Unable to update saved houses.')
      }

      setFavoriteUnitIds(prev =>
        isSaved ? prev.filter(value => value !== unitId) : [...new Set([...prev, unitId])]
      )
      setMarketplaceSuccess(body?.message || (isSaved ? 'Saved house removed.' : 'House saved successfully.'))
    } catch (error) {
      setFavoritesError(error?.message || 'Unable to update saved houses.')
    } finally {
      setFavoriteActionUnitId('')
    }
  }

  const hasPendingRoleRequest = row => {
    const requestedRole = String(row?.requestedRole || '')
      .trim()
      .toLowerCase()

    const roleValue = String(row?.role || '')
      .trim()
      .toLowerCase()

    if (!requestedRole || requestedRole === '-') {
      return false
    }

    return requestedRole !== roleValue
  }

  const openRoleDecisionDialog = (record, decision) => {
    setRoleDecisionError('')
    setRoleDecisionSuccess('')
    setRoleDecisionDialog({
      open: true,
      record,
      decision,
      notes: ''
    })
  }

  const closeRoleDecisionDialog = () => {
    setRoleDecisionDialog({
      open: false,
      record: null,
      decision: 'approve',
      notes: ''
    })
  }

  const submitRoleDecision = async () => {
    const recordId = String(roleDecisionDialog.record?.id || '').trim()

    if (!recordId) {
      setRoleDecisionError('Missing user ID for this request.')

      return
    }

    setRoleDecisionError('')

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(recordId)}/role-decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision: roleDecisionDialog.decision,
          notes: roleDecisionDialog.notes
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update role request.')
      }

      setRoleDecisionSuccess(payload?.message || 'Role request updated.')
      closeRoleDecisionDialog()
      await refreshNow()
    } catch (error) {
      setRoleDecisionError(error?.message || 'Unable to update role request.')
    }
  }

  const handleCreate = async () => {
    setFormError('')

    const missingField = createFields.find(field => field.required && !hasFieldValue(formValues[field.name]))

    if (missingField) {
      setFormError(`${missingField.label} is required.`)

      return
    }

    setIsSubmitting(true)

    try {
      const payloadValues = { ...formValues }

      for (const field of createFields) {
        if (field.type !== 'file' || !isFileValue(payloadValues[field.name])) {
          continue
        }

        const uploadForm = new FormData()

        uploadForm.set('file', payloadValues[field.name])
        uploadForm.set('moduleKey', moduleKey)

        const uploadResponse = await fetch('/api/storage/documents/upload', {
          method: 'POST',
          body: uploadForm
        })

        if (!uploadResponse.ok) {
          const uploadBody = await uploadResponse.json().catch(() => ({}))

          throw new Error(uploadBody?.error || `Unable to upload ${field.label}.`)
        }

        const uploadBody = await uploadResponse.json().catch(() => ({}))

        if (!uploadBody?.path) {
          throw new Error(`Upload did not return a file path for ${field.label}.`)
        }

        payloadValues[field.name] = uploadBody.path
      }

      const response = await fetch(`/api/modules/${moduleKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: payloadValues
        })
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))

        throw new Error(body?.error || 'Unable to create record.')
      }

      setOpenCreateDialog(false)
      await refreshNow()
    } catch (error) {
      setFormError(error?.message ?? 'Unable to create record.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card className='mp-dashboard-hero'>
            <CardContent className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <div className='flex items-center gap-2'>
                  <Typography variant='h4'>{displayTitle}</Typography>
                  <Chip label={`Source: ${sourceLabel}`} color={sourceColor} variant='tonal' size='small' />
                  <Chip label={scopeLabel} color='default' variant='outlined' size='small' />
                </div>
                <Typography className='text-textSecondary'>{displayDescription}</Typography>
                {activeFilterEntries.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-3'>
                    {activeFilterEntries.map(([key, value]) => (
                      <Chip key={`${key}:${value}`} size='small' variant='outlined' label={`${key}: ${value}`} />
                    ))}
                  </div>
                )}
              </div>
              <div className='flex flex-wrap gap-3'>
                {quickActions.map(action => (
                  <Button
                    key={action.href}
                    component={Link}
                    href={action.href}
                    variant='outlined'
                    startIcon={<i className={action.icon} />}
                  >
                    {action.label}
                  </Button>
                ))}
                <Button variant='outlined' startIcon={<i className='ri-refresh-line' />} onClick={refreshNow}>
                  Refresh
                </Button>
                {canCreate && (
                  <Button variant='contained' startIcon={<i className='ri-add-line' />} onClick={handleOpenCreate}>
                    {primaryActionLabel}
                  </Button>
                )}
                {isTenantMarketplace && (
                  <Button
                    component={Link}
                    href={savedOnlyRequested ? '/marketplace' : '/marketplace?saved=1'}
                    variant={savedOnlyRequested ? 'contained' : 'outlined'}
                    startIcon={<i className={savedOnlyRequested ? 'ri-home-heart-fill' : 'ri-home-heart-line'} />}
                  >
                    {savedOnlyRequested ? 'All Listings' : 'Saved Houses'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </Grid>

        {displayStats.map((item, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card className='bs-full mp-dashboard-kpi'>
              <CardContent>
                <Typography className='text-textSecondary'>{item.label}</Typography>
                <Typography variant='h4'>{item.value}</Typography>
                <Typography variant='body2'>{item.hint}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid item xs={12}>
          <Card className='mp-dashboard-section'>
            <CardContent>
              <div className='flex items-center justify-between gap-4 mbe-4'>
                <Typography variant='h5'>Operational Snapshot</Typography>
                <Chip label={`${visibleRows.length} Records`} color='primary' variant='tonal' size='small' />
              </div>
              {moduleError && (
                <Alert className='mbe-4' severity='error' variant='tonal'>
                  <div className='flex flex-col gap-2'>
                    <span>{moduleError}</span>
                    {showMigrationLink && (
                      <Button
                        component={Link}
                        href='/admin/migrations'
                        size='small'
                        variant='outlined'
                        className='self-start'
                      >
                        View SQL Run Order
                      </Button>
                    )}
                  </div>
                </Alert>
              )}
              {!moduleError && moduleWarning && (
                <Alert className='mbe-4' severity='warning' variant='tonal'>
                  <div className='flex flex-col gap-2'>
                    <span>{moduleWarning}</span>
                    {showMigrationLink && (
                      <Button
                        component={Link}
                        href='/admin/migrations'
                        size='small'
                        variant='outlined'
                        className='self-start'
                      >
                        View SQL Run Order
                      </Button>
                    )}
                  </div>
                </Alert>
              )}
              {roleDecisionError && (
                <Alert className='mbe-4' severity='error' variant='tonal'>
                  {roleDecisionError}
                </Alert>
              )}
              {roleDecisionSuccess && (
                <Alert className='mbe-4' severity='success' variant='tonal'>
                  {roleDecisionSuccess}
                </Alert>
              )}
              {marketplaceSuccess && (
                <Alert className='mbe-4' severity='success' variant='tonal'>
                  {marketplaceSuccess}
                </Alert>
              )}
              {favoritesError && (
                <Alert className='mbe-4' severity='warning' variant='tonal'>
                  {favoritesError}
                </Alert>
              )}
              {isTenantMarketplace && savedOnlyRequested && !favoritesError && (
                <Alert className='mbe-4' severity='info' variant='tonal'>
                  {isFavoritesLoading ? 'Loading your saved houses...' : 'Showing only houses you saved.'}
                </Alert>
              )}
              <Divider className='mbe-4' />
              {canQuery && (
                <div className='flex flex-col gap-3 mbe-4'>
                  <div className='flex flex-wrap gap-3'>
                    <TextField
                      size='small'
                      label='Search records'
                      value={searchDraft}
                      onChange={event => setSearchDraft(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          applySearch()
                        }
                      }}
                    />
                    <Button variant='contained' onClick={applySearch}>
                      Search
                    </Button>
                    <Button variant='outlined' onClick={clearSearchAndFilters}>
                      Clear
                    </Button>
                    <TextField
                      size='small'
                      select
                      label='Rows'
                      value={String(currentPageSize)}
                      onChange={event => handlePageSizeChange(event.target.value)}
                      className='min-is-[120px]'
                    >
                      {[10, 20, 50, 100].map(size => (
                        <MenuItem key={size} value={String(size)}>
                          {size}
                        </MenuItem>
                      ))}
                    </TextField>
                    {filterFields.map(field => (
                      <TextField
                        key={field.key}
                        size='small'
                        select
                        label={field.label}
                        value={String(tableQuery?.[field.key] || 'all')}
                        onChange={event => handleFilterChange(field.key, event.target.value)}
                        className='min-is-[160px]'
                      >
                        {(field.options || []).map(option => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                    ))}
                  </div>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <Typography variant='body2' color='text.secondary'>
                      {`Page ${Math.min(currentPage, totalPages)} of ${totalPages} • ${totalRows} total records`}
                    </Typography>
                    <div className='flex gap-2'>
                      <Button
                        variant='outlined'
                        size='small'
                        disabled={currentPage <= 1 || isRefreshing}
                        onClick={() => goToPage(currentPage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant='outlined'
                        size='small'
                        disabled={currentPage >= totalPages || isRefreshing}
                        onClick={() => goToPage(currentPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className='overflow-x-auto'>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      {displayColumns.map(column => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                      {hasActionsColumn && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumnCount}>
                          <Typography color='text.secondary'>
                            {isTenantMarketplace && savedOnlyRequested
                              ? 'You have not saved any houses yet.'
                              : 'No live records found for this module yet.'}
                          </Typography>
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row, index) => (
                        <tr key={index}>
                          {displayColumns.map(column => (
                            <td key={`${column.key}-${index}`}>
                              {isChipField(column.key) ? (
                                <Chip
                                  label={String(row[column.key])}
                                  size='small'
                                  variant='tonal'
                                  color={getChipColor(row[column.key])}
                                  className='capitalize'
                                />
                              ) : isDocumentPathField(column.key) && isStoredDocumentPath(row[column.key]) ? (
                                <Button
                                  component='a'
                                  href={`/api/storage/documents/download?path=${encodeURIComponent(String(row[column.key]))}`}
                                  size='small'
                                  variant='text'
                                  target='_blank'
                                  rel='noreferrer'
                                >
                                  Download
                                </Button>
                              ) : (
                                <Typography color='text.primary'>{row[column.key]}</Typography>
                              )}
                            </td>
                          ))}
                          {hasActionsColumn && (
                            <td>
                              {canUseMarketplaceActions && (
                                <div className='flex flex-wrap gap-2'>
                                  <Button
                                    size='small'
                                    variant='text'
                                    onClick={() => handleOpenMarketplaceAction('viewing', row)}
                                    disabled={!row.unitDbId || !row.ownerId}
                                  >
                                    Request Viewing
                                  </Button>
                                  <Button
                                    size='small'
                                    variant='text'
                                  onClick={() => handleOpenMarketplaceAction('booking', row)}
                                  disabled={!row.unitDbId || !row.ownerId}
                                >
                                  Book Unit
                                </Button>
                                  <Button
                                    size='small'
                                    variant='text'
                                    onClick={() => handleOpenMarketplaceAction('inquiry', row)}
                                    disabled={!row.unitDbId || !row.ownerId}
                                  >
                                    Send Inquiry
                                  </Button>
                                  <Button
                                    size='small'
                                    variant={row.isSaved ? 'outlined' : 'text'}
                                    onClick={() => handleToggleFavorite(row)}
                                    disabled={!row.unitDbId || !row.ownerId || favoriteActionUnitId === row.unitDbId}
                                  >
                                    {favoriteActionUnitId === row.unitDbId ? 'Saving...' : row.isSaved ? 'Saved' : 'Save House'}
                                  </Button>
                                </div>
                              )}
                              {canUseUserActions && (
                                <div className='flex flex-wrap gap-2'>
                                  {hasPendingRoleRequest(row) ? (
                                    <>
                                      <Button
                                        size='small'
                                        variant='outlined'
                                        onClick={() => openRoleDecisionDialog(row, 'approve')}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size='small'
                                        color='error'
                                        variant='outlined'
                                        onClick={() => openRoleDecisionDialog(row, 'reject')}
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  ) : (
                                    <Typography color='text.secondary'>-</Typography>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} fullWidth maxWidth='sm'>
        <DialogTitle>{primaryActionLabel}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-4'>
          {formError && <Alert severity='error'>{formError}</Alert>}
          {createFields.map(field =>
            field.type === 'select' ? (
              <TextField
                key={field.name}
                label={field.label}
                select
                fullWidth
                required={field.required}
                value={formValues[field.name] || ''}
                onChange={event => handleFieldChange(field.name, event.target.value)}
              >
                {(field.options || []).map(option => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            ) : field.type === 'file' ? (
              <TextField
                key={field.name}
                label={field.label}
                fullWidth
                required={field.required}
                type='file'
                placeholder={field.placeholder || ''}
                onChange={event => handleFieldChange(field.name, event.target.files?.[0] || null)}
                helperText={isFileValue(formValues[field.name]) ? formValues[field.name].name : ''}
                InputLabelProps={{ shrink: true }}
                inputProps={{
                  accept: field.accept || undefined
                }}
              />
            ) : (
              <TextField
                key={field.name}
                label={field.label}
                fullWidth
                required={field.required}
                type={field.type || 'text'}
                placeholder={field.placeholder || ''}
                value={formValues[field.name] || ''}
                onChange={event => handleFieldChange(field.name, event.target.value)}
              />
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} variant='contained' disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} color='inherit' /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openMarketplaceDialog} onClose={() => setOpenMarketplaceDialog(false)} fullWidth maxWidth='sm'>
        <DialogTitle>{getMarketplaceDialogTitle(marketplaceAction)}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-4'>
          {marketplaceError && <Alert severity='error'>{marketplaceError}</Alert>}
          <Typography color='text.secondary'>
            {selectedListing?.listing ? `Listing: ${selectedListing.listing}` : 'Complete details to continue.'}
          </Typography>
          {marketplaceAction === 'viewing' ? (
            <TextField
              label='Preferred Viewing Time'
              type='datetime-local'
              fullWidth
              required
              value={marketplaceForm.preferredTime}
              onChange={event => handleMarketplaceFormChange('preferredTime', event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          ) : marketplaceAction === 'booking' ? (
            <>
              <TextField
                label='Booking Fee (KES)'
                type='number'
                fullWidth
                value={marketplaceForm.bookingFee}
                onChange={event => handleMarketplaceFormChange('bookingFee', event.target.value)}
              />
              <TextField
                label='Hold Expires At'
                type='datetime-local'
                fullWidth
                value={marketplaceForm.expiresAt}
                onChange={event => handleMarketplaceFormChange('expiresAt', event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          ) : (
            <Alert severity='info' variant='tonal'>
              Ask about rent, availability, amenities, or move-in details. Your message will appear in the landlord messaging workspace.
            </Alert>
          )}
          <TextField
            label={marketplaceAction === 'inquiry' ? 'Message' : 'Notes'}
            fullWidth
            multiline
            minRows={3}
            value={marketplaceForm.notes}
            onChange={event => handleMarketplaceFormChange('notes', event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMarketplaceDialog(false)} disabled={isMarketplaceSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitMarketplaceAction} variant='contained' disabled={isMarketplaceSubmitting}>
            {isMarketplaceSubmitting ? <CircularProgress size={20} color='inherit' /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={roleDecisionDialog.open} onClose={closeRoleDecisionDialog} fullWidth maxWidth='sm'>
        <DialogTitle>
          {roleDecisionDialog.decision === 'approve' ? 'Approve Role Request' : 'Reject Role Request'}
        </DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-4'>
          <Typography color='text.secondary'>
            {roleDecisionDialog.record?.name
              ? `${roleDecisionDialog.record.name} requested ${String(roleDecisionDialog.record.requestedRole || '').toLowerCase()} access.`
              : 'Review the selected role request.'}
          </Typography>
          <TextField
            label='Notes (optional)'
            fullWidth
            multiline
            minRows={3}
            value={roleDecisionDialog.notes}
            onChange={event =>
              setRoleDecisionDialog(prev => ({
                ...prev,
                notes: event.target.value
              }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRoleDecisionDialog}>Cancel</Button>
          <Button
            variant='contained'
            color={roleDecisionDialog.decision === 'approve' ? 'primary' : 'error'}
            onClick={submitRoleDecision}
          >
            {roleDecisionDialog.decision === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ModulePage
