'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Pagination from '@mui/material/Pagination'
import Skeleton from '@mui/material/Skeleton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import tableStyles from '@core/styles/table.module.css'
import { useModuleListQuery } from '@/hooks/useModuleListQuery'

const PAGE_SIZE = 20

const toText = value => String(value ?? '').trim()

const toCsvValue = value => `"${String(value ?? '').replace(/"/g, '""')}"`

const getStatusColor = value => {
  const normalized = toText(value).toLowerCase()

  if (normalized === 'active') {
    return 'success'
  }

  if (normalized === 'pending' || normalized.includes('scheduled')) {
    return 'warning'
  }

  if (normalized === 'terminated') {
    return 'error'
  }

  return 'default'
}

const exportRowsToCsv = rows => {
  const header = ['Agreement ID', 'Tenant', 'Unit', 'Move In', 'Move Out', 'Status']
  const body = rows.map(row => [row.agreementId, row.tenant, row.unit, row.moveIn, row.moveOut, row.status].map(toCsvValue).join(','))
  const csv = [header.map(toCsvValue).join(','), ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.setAttribute('download', `rentpilot-tenancies-${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const LoadingRows = () => {
  return Array.from({ length: 6 }).map((_, index) => (
    <tr key={`loading-row-${index}`}>
      <td colSpan={7}>
        <Skeleton variant='rounded' height={28} />
      </td>
    </tr>
  ))
}

const TenanciesManagementPage = ({ title, description, rows, stats, dataSource }) => {
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [unitFilter, setUnitFilter] = useState('')
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState('')

  const deferredSearch = useDeferredValue(searchText)
  const deferredUnit = useDeferredValue(unitFilter)

  const initialData = useMemo(
    () => ({
      rows: rows || [],
      stats: stats || [],
      dataSource: dataSource || 'sample',
      pagination: {
        page: 1,
        pageSize: PAGE_SIZE,
        totalRows: (rows || []).length,
        totalPages: Math.max(1, Math.ceil((rows || []).length / PAGE_SIZE))
      }
    }),
    [dataSource, rows, stats]
  )

  const { rows: pagedRows, dataSource: liveSource, pagination, isLoading, isFetching, error, refetch } = useModuleListQuery({
    moduleKey: 'tenancies',
    page,
    pageSize: PAGE_SIZE,
    search: deferredSearch,
    filters: {
      status: statusFilter,
      unit: deferredUnit
    },
    initialData,
    staleTime: 60_000,
    refetchInterval: 90_000
  })

  const totalPages = Math.max(1, Number(pagination?.totalPages) || 1)
  const totalRows = Math.max(0, Number(pagination?.totalRows) || 0)

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, deferredUnit, statusFilter])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleDelete = async row => {
    if (!row?.id) {
      setActionError('This row cannot be deleted because the record id is missing.')

      return
    }

    if (!window.confirm(`Delete tenancy ${row.agreementId || row.id}? This action cannot be undone.`)) {
      return
    }

    setActionError('')

    const response = await fetch(`/api/modules/tenancies/${row.id}`, {
      method: 'DELETE'
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setActionError(body?.error || 'Unable to delete tenancy mapping.')

      return
    }

    await refetch()
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Card className='mp-dashboard-hero mp-perf-card'>
          <CardContent className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <Typography variant='h4'>{title}</Typography>
                <Chip
                  label={isFetching ? 'Syncing...' : liveSource === 'live' ? 'Live Data' : 'Sample Data'}
                  color={isFetching ? 'info' : liveSource === 'live' ? 'success' : 'warning'}
                  variant='tonal'
                  size='small'
                />
              </div>
              <Typography className='text-textSecondary'>{description}</Typography>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Button variant='outlined' startIcon={<i className='ri-refresh-line' />} onClick={refetch} disabled={isFetching}>
                Refresh
              </Button>
              <Button variant='outlined' startIcon={<i className='ri-download-line' />} onClick={() => exportRowsToCsv(pagedRows)}>
                Export CSV
              </Button>
              <Button component={Link} href='/tenancies/create' variant='contained' startIcon={<i className='ri-link-m' />}>
                Create Mapping
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {(stats || []).map((item, index) => (
        <Grid item xs={12} sm={6} md={3} key={`${item.label}-${index}`}>
          <Card className='bs-full mp-dashboard-kpi mp-perf-card'>
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
            {actionError ? (
              <Alert className='mbe-4' severity='error' variant='tonal'>
                {actionError}
              </Alert>
            ) : null}
            {error ? (
              <Alert className='mbe-4' severity='warning' variant='tonal'>
                {error}
              </Alert>
            ) : null}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mbe-4'>
              <TextField label='Search agreements' value={searchText} onChange={event => setSearchText(event.target.value)} />
              <TextField select label='Status' value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <MenuItem value='all'>All</MenuItem>
                <MenuItem value='active'>active</MenuItem>
                <MenuItem value='pending'>pending</MenuItem>
                <MenuItem value='move-out scheduled'>move-out scheduled</MenuItem>
                <MenuItem value='terminated'>terminated</MenuItem>
              </TextField>
              <TextField label='Unit filter' value={unitFilter} onChange={event => setUnitFilter(event.target.value)} />
            </div>

            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Agreement ID</th>
                    <th>Tenant</th>
                    <th>Unit</th>
                    <th>Move In</th>
                    <th>Move Out</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <LoadingRows />
                  ) : pagedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <Typography color='text.secondary'>No tenancies matched your filters.</Typography>
                      </td>
                    </tr>
                  ) : (
                    pagedRows.map(row => (
                      <tr key={row.id || row.agreementId}>
                        <td>{row.agreementId}</td>
                        <td>{row.tenant}</td>
                        <td>{row.unit}</td>
                        <td>{row.moveIn || 'N/A'}</td>
                        <td>{row.moveOut || 'N/A'}</td>
                        <td>
                          <Chip label={row.status} size='small' variant='tonal' color={getStatusColor(row.status)} />
                        </td>
                        <td>
                          <div className='flex flex-wrap gap-2'>
                            <Button
                              component={Link}
                              href={row.id ? `/tenancies/${row.id}/edit` : '#'}
                              size='small'
                              variant='text'
                              disabled={!row.id}
                            >
                              Edit
                            </Button>
                            <Button size='small' color='error' variant='text' disabled={!row.id} onClick={() => handleDelete(row)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className='flex items-center justify-between mt-4 gap-3 flex-wrap'>
              <Typography variant='body2' color='text.secondary'>
                {totalRows.toLocaleString('en-KE')} records
              </Typography>
              <div className='flex items-center gap-2'>
                {isFetching ? <CircularProgress size={18} /> : null}
                <Pagination page={page} count={totalPages} onChange={(_, nextPage) => setPage(nextPage)} color='primary' />
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default TenanciesManagementPage

