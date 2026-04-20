'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import tableStyles from '@core/styles/table.module.css'

const statusColor = value => {
  const normalized = String(value || '').toLowerCase()

  if (normalized.includes('approved')) {
    return 'success'
  }

  if (normalized.includes('rejected')) {
    return 'error'
  }

  return 'warning'
}

const formatKES = value => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 'KES 0'
  }

  return `KES ${Math.max(0, parsed).toLocaleString('en-KE')}`
}

const formatDate = value => {
  if (!value) {
    return 'N/A'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'N/A'
  }

  return parsed.toLocaleDateString('en-KE')
}

const LandlordIncomingProofs = () => {
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({ pending: 0, approved: 0, rejected: 0 })
  const [filter, setFilter] = useState('pending review')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [actingId, setActingId] = useState('')
  const [bulkAction, setBulkAction] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const loadProofs = useCallback(
    async ({ withLoading = false } = {}) => {
      if (withLoading) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError('')

      try {
        const params = new URLSearchParams()

        if (filter) {
          params.set('status', filter)
        }

        const response = await fetch(`/api/landlord/payment-proofs?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store'
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load payment proofs.')
        }

        setRows(Array.isArray(payload?.proofs) ? payload.proofs : [])
        setSummary(payload?.summary || { pending: 0, approved: 0, rejected: 0 })
      } catch (fetchError) {
        setError(fetchError?.message || 'Unable to load payment proofs.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [filter]
  )

  useEffect(() => {
    loadProofs({ withLoading: true })
  }, [loadProofs])

  useEffect(() => {
    const validIds = new Set(rows.map(row => row.id).filter(Boolean))

    setSelectedIds(prev => prev.filter(id => validIds.has(id)))
  }, [rows])

  const handleDecision = async (row, decision) => {
    if (!row?.id) {
      return
    }

    setActingId(row.id)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/landlord/payment-proofs/${encodeURIComponent(row.id)}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update proof decision.')
      }

      setSuccess(`Proof marked as ${payload?.status || decision}.`)
      await loadProofs({ withLoading: false })
    } catch (decisionError) {
      setError(decisionError?.message || 'Unable to update proof decision.')
    } finally {
      setActingId('')
    }
  }

  const handleBulkDecision = async decision => {
    if (!selectedIds.length) {
      return
    }

    setBulkAction(decision)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/landlord/payment-proofs/bulk-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          decision,
          docIds: selectedIds
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to apply bulk decision.')
      }

      setSelectedIds([])
      setSuccess(`${payload?.updated || 0} proofs marked as ${payload?.status || decision}.`)
      await loadProofs({ withLoading: false })
    } catch (decisionError) {
      setError(decisionError?.message || 'Unable to apply bulk decision.')
    } finally {
      setBulkAction('')
    }
  }

  const toggleSelected = rowId => {
    if (!rowId) {
      return
    }

    setSelectedIds(prev => (prev.includes(rowId) ? prev.filter(id => id !== rowId) : [...prev, rowId]))
  }

  const toggleSelectAll = checked => {
    if (!checked) {
      setSelectedIds([])

      return
    }

    setSelectedIds(rows.map(row => row.id).filter(Boolean))
  }

  const headerChips = useMemo(
    () => [
      { label: `Pending ${summary.pending || 0}`, color: 'warning' },
      { label: `Approved ${summary.approved || 0}`, color: 'success' },
      { label: `Rejected ${summary.rejected || 0}`, color: 'error' }
    ],
    [summary]
  )

  const selectableCount = rows.length
  const allSelected = selectableCount > 0 && selectedIds.length === selectableCount
  const partiallySelected = selectedIds.length > 0 && selectedIds.length < selectableCount
  const isBulkBusy = Boolean(bulkAction)

  return (
    <Card className='mp-dashboard-section mp-perf-card'>
      <CardContent>
        <div className='flex flex-wrap items-center justify-between gap-3 mbe-4'>
          <Typography variant='h5'>Incoming Tenant Proofs</Typography>
          <div className='flex flex-wrap items-center gap-2'>
            {headerChips.map(item => (
              <Chip key={item.label} label={item.label} color={item.color} variant='tonal' size='small' />
            ))}
            <TextField
              select
              size='small'
              label='Filter'
              value={filter}
              onChange={event => setFilter(event.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value='pending review'>Pending Review</MenuItem>
              <MenuItem value='approved'>Approved</MenuItem>
              <MenuItem value='rejected'>Rejected</MenuItem>
              <MenuItem value='all'>All</MenuItem>
            </TextField>
            <Chip label={`${selectedIds.length} selected`} color={selectedIds.length ? 'primary' : 'default'} size='small' />
            <Button
              size='small'
              variant='contained'
              color='success'
              disabled={!selectedIds.length || isBulkBusy}
              onClick={() => handleBulkDecision('approve')}
            >
              {bulkAction === 'approve' ? 'Approving...' : 'Bulk Approve'}
            </Button>
            <Button
              size='small'
              variant='outlined'
              color='error'
              disabled={!selectedIds.length || isBulkBusy}
              onClick={() => handleBulkDecision('reject')}
            >
              {bulkAction === 'reject' ? 'Rejecting...' : 'Bulk Reject'}
            </Button>
            <Button variant='outlined' size='small' onClick={() => loadProofs({ withLoading: false })} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {error && (
          <Alert className='mbe-3' severity='error' variant='tonal'>
            {error}
          </Alert>
        )}
        {success && (
          <Alert className='mbe-3' severity='success' variant='tonal'>
            {success}
          </Alert>
        )}

        {loading ? (
          <div className='flex items-center gap-3 py-4'>
            <CircularProgress size={20} />
            <Typography>Loading proof submissions...</Typography>
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className={tableStyles.table}>
              <thead>
                <tr>
                  <th>
                    <Checkbox
                      size='small'
                      checked={allSelected}
                      indeterminate={partiallySelected}
                      onChange={event => toggleSelectAll(event.target.checked)}
                    />
                  </th>
                  <th>Tenant</th>
                  <th>Submitted</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th>Proof</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <Typography color='text.secondary'>No tenant payment proofs found for this filter.</Typography>
                    </td>
                  </tr>
                ) : (
                  rows.map(row => {
                    const busy = actingId === row.id || isBulkBusy
                    const method = row?.payment?.method || row?.payment?.channel || 'Not specified'
                    const amount = row?.payment?.amount
                    const isSelected = selectedIds.includes(row.id)

                    return (
                      <tr key={row.id}>
                        <td>
                          <Checkbox size='small' checked={isSelected} onChange={() => toggleSelected(row.id)} disabled={isBulkBusy} />
                        </td>
                        <td>
                          <Typography color='text.primary'>{row.tenantName || 'Tenant'}</Typography>
                        </td>
                        <td>
                          <Typography color='text.primary'>{formatDate(row.uploaded || row.createdAt)}</Typography>
                        </td>
                        <td>
                          <Typography color='text.primary'>{method}</Typography>
                        </td>
                        <td>
                          <Typography color='text.primary'>{amount ? formatKES(amount) : 'N/A'}</Typography>
                        </td>
                        <td>
                          <Typography color='text.primary'>{row?.payment?.receiptNo || 'Pending'}</Typography>
                        </td>
                        <td>
                          <Chip label={row.status || 'pending review'} size='small' variant='tonal' color={statusColor(row.status)} />
                        </td>
                        <td>
                          {row.filePath ? (
                            <Button
                              component='a'
                              href={`/api/storage/documents/download?path=${encodeURIComponent(String(row.filePath))}`}
                              target='_blank'
                              rel='noreferrer'
                              size='small'
                              variant='text'
                            >
                              Download
                            </Button>
                          ) : (
                            <Typography color='text.secondary'>Missing</Typography>
                          )}
                        </td>
                        <td>
                          <div className='flex flex-wrap gap-2'>
                            <Button
                              size='small'
                              variant='contained'
                              color='success'
                              disabled={busy || String(row.status || '').toLowerCase() === 'approved'}
                              onClick={() => handleDecision(row, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              size='small'
                              variant='outlined'
                              color='error'
                              disabled={busy || String(row.status || '').toLowerCase() === 'rejected'}
                              onClick={() => handleDecision(row, 'reject')}
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default LandlordIncomingProofs
