'use client'

import { useMemo, useState } from 'react'

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
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { DEFAULT_CURRENCY } from '@/libs/constants'
import { useRealtimeModuleData } from '@/hooks/useRealtimeModuleData'

const toText = value => String(value || '').trim()

const toNumber = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const normalizeStatus = value => toText(value).toLowerCase()

const statusColor = status => {
  const normalized = normalizeStatus(status)

  if (['active'].includes(normalized)) {
    return 'success'
  }

  if (['pending'].includes(normalized)) {
    return 'warning'
  }

  if (['inactive', 'disabled', 'archived'].includes(normalized)) {
    return 'error'
  }

  return 'default'
}

const INITIAL_FORM = {
  ruleName: '',
  scope: '',
  rateType: 'percent',
  ratePercent: '',
  flatAmount: '',
  status: 'active',
  currency: DEFAULT_CURRENCY,
  note: ''
}

const FeesCommissionsAdminView = ({ initialData }) => {
  const [openDialog, setOpenDialog] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [formValues, setFormValues] = useState(INITIAL_FORM)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { rows, isRefreshing, refreshNow } = useRealtimeModuleData({
    moduleKey: 'fees',
    initialRows: initialData?.rows || [],
    initialStats: initialData?.stats || [],
    initialDataSource: initialData?.dataSource || 'live'
  })

  const stats = useMemo(() => {
    const active = rows.filter(row => normalizeStatus(row?.status) === 'active').length
    const percentageRules = rows.filter(row => toNumber(row?.ratePercent) !== null).length
    const flatRules = rows.filter(row => toNumber(row?.flatAmount) !== null).length

    return [
      { label: 'Active Rules', value: String(active), hint: 'Currently enforced fee rules' },
      { label: 'Commission Rules', value: String(percentageRules), hint: 'Percentage based policies' },
      { label: 'Flat Fee Rules', value: String(flatRules), hint: 'Fixed amount billing policies' },
      { label: 'Total Rules', value: String(rows.length), hint: 'All configured platform rules' }
    ]
  }, [rows])

  const closeDialog = () => {
    setOpenDialog(false)
    setEditingRow(null)
    setFormValues(INITIAL_FORM)
    setSubmitError('')
  }

  const openCreateDialog = () => {
    setEditingRow(null)
    setFormValues(INITIAL_FORM)
    setSubmitError('')
    setSuccessMessage('')
    setOpenDialog(true)
  }

  const openEditDialog = row => {
    const ratePercent = toNumber(row?.ratePercent)
    const flatAmount = toNumber(row?.flatAmount)

    setEditingRow(row)
    setFormValues({
      ruleName: toText(row?.rule),
      scope: toText(row?.scope),
      rateType: ratePercent !== null ? 'percent' : 'flat',
      ratePercent: ratePercent !== null ? String(ratePercent) : '',
      flatAmount: flatAmount !== null ? String(flatAmount) : '',
      status: toText(row?.status) || 'active',
      currency: 'KES',
      note: ''
    })
    setSubmitError('')
    setSuccessMessage('')
    setOpenDialog(true)
  }

  const handleQuickToggle = async row => {
    const identifier = toText(row?.recordId)

    if (!identifier) {
      setSubmitError('Rule identifier is missing for this row.')

      return
    }

    const nextStatus = normalizeStatus(row?.status) === 'active' ? 'inactive' : 'active'

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch(`/api/admin/fees/${encodeURIComponent(identifier)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: nextStatus,
          active: nextStatus === 'active'
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update rule status.')
      }

      setSuccessMessage(`Rule status updated to ${nextStatus}.`)
      await refreshNow()
    } catch (error) {
      setSubmitError(error?.message || 'Unable to update rule status.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    const ruleName = toText(formValues.ruleName)
    const scope = toText(formValues.scope)

    if (!ruleName) {
      setSubmitError('Rule name is required.')

      return
    }

    if (!scope) {
      setSubmitError('Scope is required.')

      return
    }

    const payload = {
      ruleName,
      scope,
      status: normalizeStatus(formValues.status || 'active'),
      currency: toText(formValues.currency || 'KES'),
      note: toText(formValues.note)
    }

    const ratePercentValue = formValues.rateType === 'percent' ? toNumber(formValues.ratePercent) : null
    const flatAmountValue = formValues.rateType === 'flat' ? toNumber(formValues.flatAmount) : null

    if (ratePercentValue === null && flatAmountValue === null) {
      setSubmitError('Enter a valid percent or flat amount.')

      return
    }

    if (formValues.rateType === 'percent') {
      payload.ratePercent = ratePercentValue
      payload.clearFlatAmount = true
    } else {
      payload.flatAmount = flatAmountValue
      payload.clearRatePercent = true
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const isEdit = Boolean(editingRow?.recordId)
      const endpoint = isEdit ? `/api/admin/fees/${encodeURIComponent(toText(editingRow.recordId))}` : '/api/admin/fees'
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const responseBody = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(responseBody?.error || 'Unable to save fee rule.')
      }

      setSuccessMessage(isEdit ? 'Fee rule updated successfully.' : 'Fee rule created successfully.')
      closeDialog()
      await refreshNow()
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save fee rule.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Card className='mp-dashboard-hero'>
          <CardContent className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <Typography variant='h4'>Fees & Commissions</Typography>
                <Chip
                  label={isRefreshing ? 'Syncing...' : 'Live Data'}
                  color={isRefreshing ? 'info' : 'success'}
                  variant='tonal'
                  size='small'
                />
              </div>
              <Typography className='text-textSecondary'>
                Create, edit, and activate fee rules directly from the admin billing panel.
              </Typography>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Button variant='outlined' startIcon={<i className='ri-refresh-line' />} onClick={refreshNow}>
                Refresh
              </Button>
              <Button variant='contained' startIcon={<i className='ri-add-line' />} onClick={openCreateDialog}>
                Add Fee Rule
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {(submitError || successMessage) && (
        <Grid item xs={12}>
          {submitError && (
            <Alert severity='error' variant='tonal'>
              {submitError}
            </Alert>
          )}
          {!submitError && successMessage && (
            <Alert severity='success' variant='tonal'>
              {successMessage}
            </Alert>
          )}
        </Grid>
      )}

      {stats.map(stat => (
        <Grid item xs={12} sm={6} md={3} key={stat.label}>
          <Card className='mp-dashboard-kpi'>
            <CardContent>
              <Typography className='text-textSecondary'>{stat.label}</Typography>
              <Typography variant='h4'>{stat.value}</Typography>
              <Typography variant='body2'>{stat.hint}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid item xs={12}>
        <Card className='mp-dashboard-section'>
          <CardContent>
            <Typography variant='h5' className='mbe-4'>
              Fee Rules
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Rule</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Rate</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Updated</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!rows.length ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography color='text.secondary'>No fee rules found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map(row => (
                      <TableRow key={toText(row?.recordId || row?.rule) || row?.updatedAt}>
                        <TableCell>{toText(row?.rule) || '-'}</TableCell>
                        <TableCell>{toText(row?.scope) || '-'}</TableCell>
                        <TableCell>{toText(row?.rate) || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={toText(row?.status) || '-'}
                            color={statusColor(row?.status)}
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell>{toText(row?.updatedAt) || '-'}</TableCell>
                        <TableCell align='right'>
                          <div className='flex justify-end gap-2'>
                            <Button size='small' variant='outlined' onClick={() => openEditDialog(row)}>
                              Edit
                            </Button>
                            <Button
                              size='small'
                              variant='outlined'
                              onClick={() => handleQuickToggle(row)}
                              disabled={isSubmitting}
                            >
                              {normalizeStatus(row?.status) === 'active' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={openDialog} onClose={closeDialog} fullWidth maxWidth='sm'>
        <DialogTitle>{editingRow ? 'Edit Fee Rule' : 'Add Fee Rule'}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-4'>
          <TextField
            label='Rule Name'
            value={formValues.ruleName}
            onChange={event => setFormValues(prev => ({ ...prev, ruleName: event.target.value }))}
            required
          />
          <TextField
            label='Scope'
            value={formValues.scope}
            onChange={event => setFormValues(prev => ({ ...prev, scope: event.target.value }))}
            required
          />
          <TextField
            label='Rate Type'
            select
            value={formValues.rateType}
            onChange={event =>
              setFormValues(prev => ({
                ...prev,
                rateType: event.target.value
              }))
            }
          >
            <MenuItem value='percent'>Percent (%)</MenuItem>
            <MenuItem value='flat'>Flat Amount (KES)</MenuItem>
          </TextField>
          {formValues.rateType === 'percent' ? (
            <TextField
              label='Rate Percent'
              type='number'
              value={formValues.ratePercent}
              onChange={event => setFormValues(prev => ({ ...prev, ratePercent: event.target.value }))}
            />
          ) : (
            <TextField
              label='Flat Amount (KES)'
              type='number'
              value={formValues.flatAmount}
              onChange={event => setFormValues(prev => ({ ...prev, flatAmount: event.target.value }))}
            />
          )}
          <TextField
            label='Status'
            select
            value={formValues.status}
            onChange={event => setFormValues(prev => ({ ...prev, status: event.target.value }))}
          >
            <MenuItem value='active'>active</MenuItem>
            <MenuItem value='inactive'>inactive</MenuItem>
            <MenuItem value='pending'>pending</MenuItem>
          </TextField>
          <TextField
            label='Internal Note (optional)'
            multiline
            minRows={3}
            value={formValues.note}
            onChange={event => setFormValues(prev => ({ ...prev, note: event.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant='contained' disabled={isSubmitting}>
            {isSubmitting ? (
              <CircularProgress size={20} color='inherit' />
            ) : editingRow ? (
              'Save Changes'
            ) : (
              'Create Rule'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default FeesCommissionsAdminView
