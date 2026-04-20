'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
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

const toText = value => String(value || '').trim()
const toBoolean = value => value === true

const toDisplayDate = value => {
  const raw = toText(value)

  if (!raw) {
    return '-'
  }

  const parsed = new Date(raw)

  if (Number.isNaN(parsed.getTime())) {
    return raw
  }

  return parsed.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const INITIAL_DIALOG = {
  open: false,
  entityType: '',
  record: null,
  decision: 'approve',
  notes: '',
  ownershipVerified: false
}

const KYC_STATUS_COLOR = {
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
  resubmit: 'info'
}

const LandlordVerificationAdminView = () => {
  const [landlords, setLandlords] = useState([])
  const [plots, setPlots] = useState([])
  const [kycDocuments, setKycDocuments] = useState([])
  const [kycSummary, setKycSummary] = useState({ pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [dialog, setDialog] = useState(INITIAL_DIALOG)

  const queueStats = useMemo(() => {
    const landlordsMissingKyc = landlords.filter(landlord => !toBoolean(landlord?.kyc_verified)).length
    const plotsNotVerified = plots.filter(plot => !toBoolean(plot?.ownership_verified)).length

    return [
      { label: 'Pending Accounts', value: String(landlords.length), hint: 'Landlords and agents awaiting admin decision' },
      { label: 'Pending KYC Docs', value: String(kycSummary.pending || 0), hint: 'Documents waiting for review' },
      { label: 'Pending Plots', value: String(plots.length), hint: 'Plot listings awaiting approval' },
      { label: 'Accounts Missing KYC', value: String(landlordsMissingKyc), hint: 'Cannot be approved yet' },
      { label: 'Plots Pending Ownership Check', value: String(plotsNotVerified), hint: 'Fraud risk controls pending' }
    ]
  }, [kycSummary.pending, landlords, plots])

  const loadQueues = useCallback(async () => {
    setLoading(true)
    setError('')
    setWarning('')

    try {
      const [landlordResponse, plotsResponse, kycResponse] = await Promise.all([
        fetch('/api/admin/landlords/pending', { cache: 'no-store' }),
        fetch('/api/admin/plots/pending', { cache: 'no-store' }),
        fetch('/api/admin/landlord-documents/pending?status=pending', { cache: 'no-store' })
      ])

      const [landlordPayload, plotsPayload, kycPayload] = await Promise.all([
        landlordResponse.json().catch(() => ({})),
        plotsResponse.json().catch(() => ({})),
        kycResponse.json().catch(() => ({}))
      ])

      const warnings = [landlordPayload?.warning, plotsPayload?.warning, kycPayload?.warning].filter(Boolean)

      if (warnings.length) {
        setWarning(warnings.join(' '))
      }

      if (!landlordResponse.ok) {
        throw new Error(landlordPayload?.error || 'Unable to load pending landlords.')
      }

      if (!plotsResponse.ok) {
        throw new Error(plotsPayload?.error || 'Unable to load pending plots.')
      }

      if (!kycResponse.ok) {
        throw new Error(kycPayload?.error || 'Unable to load pending KYC documents.')
      }

      setLandlords(Array.isArray(landlordPayload?.landlords) ? landlordPayload.landlords : [])
      setPlots(Array.isArray(plotsPayload?.plots) ? plotsPayload.plots : [])
      setKycDocuments(Array.isArray(kycPayload?.documents) ? kycPayload.documents : [])
      setKycSummary(kycPayload?.summary || { pending: 0, approved: 0, rejected: 0 })
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load verification queues.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQueues()
  }, [loadQueues])

  const closeDialog = () => {
    setDialog(INITIAL_DIALOG)
  }

  const openLandlordDialog = (record, decision) => {
    setDialog({
      open: true,
      entityType: 'landlord',
      record,
      decision,
      notes: '',
      ownershipVerified: false
    })
  }

  const openPlotDialog = (record, decision) => {
    setDialog({
      open: true,
      entityType: 'plot',
      record,
      decision,
      notes: '',
      ownershipVerified: decision === 'approve'
    })
  }

  const openKycDialog = (record, decision) => {
    setDialog({
      open: true,
      entityType: 'kyc',
      record,
      decision,
      notes: '',
      ownershipVerified: false
    })
  }

  const submitDecision = async () => {
    const entityType = toText(dialog.entityType)
    const recordId = toText(dialog.record?.id)

    if (!recordId) {
      setError('Missing record ID for this decision.')

      return
    }

    if (entityType === 'plot' && dialog.decision === 'approve' && !dialog.ownershipVerified) {
      setError('Confirm ownership verification before approving this plot.')

      return
    }

    setSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      const endpoint =
        entityType === 'landlord'
          ? `/api/admin/landlords/${encodeURIComponent(recordId)}/decision`
          : entityType === 'plot'
            ? `/api/admin/plots/${encodeURIComponent(recordId)}/decision`
            : `/api/admin/landlord-documents/${encodeURIComponent(recordId)}/decision`

      const payload = {
        decision: dialog.decision,
        notes: toText(dialog.notes)
      }

      if (entityType === 'plot') {
        payload.ownershipVerified = dialog.decision === 'approve' ? dialog.ownershipVerified : false
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const responseBody = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(responseBody?.error || 'Unable to submit admin decision.')
      }

      setSuccessMessage(responseBody?.message || 'Decision saved successfully.')
      closeDialog()
      await loadQueues()
    } catch (submitError) {
      setError(submitError?.message || 'Unable to save this decision.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Card className='mp-dashboard-hero'>
          <CardContent className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <Typography variant='h4'>Landlord, Agent & Plot Verification</Typography>
              <Typography className='text-textSecondary'>
                Approve only verified landlord and agent accounts, plus ownership-confirmed plots, before marketplace access unlocks.
              </Typography>
            </div>
            <Button variant='outlined' startIcon={<i className='ri-refresh-line' />} onClick={loadQueues} disabled={loading || submitting}>
              Refresh Queue
            </Button>
          </CardContent>
        </Card>
      </Grid>

      {(error || warning || successMessage) && (
        <Grid item xs={12}>
          {error && (
            <Alert severity='error' variant='tonal'>
              {error}
            </Alert>
          )}
          {!error && warning && (
            <Alert severity='warning' variant='tonal'>
              {warning}
            </Alert>
          )}
          {!error && successMessage && (
            <Alert severity='success' variant='tonal'>
              {successMessage}
            </Alert>
          )}
        </Grid>
      )}

      {queueStats.map(stat => (
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
            <div className='mbe-4'>
              <Typography variant='h5'>Pending KYC Documents</Typography>
              <Typography color='text.secondary'>
                Review identity and ownership documents before approving landlord or agent accounts.
              </Typography>
            </div>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Document</TableCell>
                    <TableCell>Uploaded</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>File</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align='center'>
                        <CircularProgress size={22} />
                      </TableCell>
                    </TableRow>
                  ) : kycDocuments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography color='text.secondary'>No pending KYC documents found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    kycDocuments.map(document => (
                      <TableRow key={toText(document.id)}>
                        <TableCell>
                          <div className='flex flex-col'>
                            <Typography variant='body2'>{toText(document.landlord?.name) || '-'}</Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {toText(document.landlord?.phone) || toText(document.landlord?.email) || '-'}
                            </Typography>
                          </div>
                        </TableCell>
                        <TableCell>{toText(document.landlord?.role) || '-'}</TableCell>
                        <TableCell>{toText(document.documentLabel) || '-'}</TableCell>
                        <TableCell>{toDisplayDate(document.createdAt)}</TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={toText(document.verificationStatus) || 'pending'}
                            color={KYC_STATUS_COLOR[toText(document.verificationStatus).toLowerCase()] || 'default'}
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size='small'
                            variant='text'
                            component='a'
                            href={`/api/storage/documents/download?path=${encodeURIComponent(toText(document.filePath))}`}
                            target='_blank'
                            rel='noreferrer'
                          >
                            View file
                          </Button>
                        </TableCell>
                        <TableCell align='right'>
                          <div className='flex justify-end gap-2'>
                            <Button size='small' variant='outlined' disabled={submitting} onClick={() => openKycDialog(document, 'approved')}>
                              Approve
                            </Button>
                            <Button size='small' color='warning' variant='outlined' disabled={submitting} onClick={() => openKycDialog(document, 'resubmit')}>
                              Resubmit
                            </Button>
                            <Button size='small' color='error' variant='outlined' disabled={submitting} onClick={() => openKycDialog(document, 'rejected')}>
                              Reject
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

      <Grid item xs={12}>
        <Card className='mp-dashboard-section'>
          <CardContent>
            <Typography variant='h5' className='mbe-4'>
              Pending Landlords & Agents
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>KYC</TableCell>
                    <TableCell>Plots</TableCell>
                    <TableCell>Registered</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align='center'>
                        <CircularProgress size={22} />
                      </TableCell>
                    </TableRow>
                  ) : landlords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography color='text.secondary'>No pending landlord or agent accounts found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    landlords.map(landlord => (
                      <TableRow key={toText(landlord.id)}>
                        <TableCell>{toText(landlord.name) || '-'}</TableCell>
                        <TableCell>{toText(landlord.role) || '-'}</TableCell>
                        <TableCell>
                          <div className='flex flex-col'>
                            <Typography variant='body2'>{toText(landlord.phone) || '-'}</Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {toText(landlord.email) || '-'}
                            </Typography>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={toBoolean(landlord.kyc_verified) ? 'verified' : 'pending'}
                            color={toBoolean(landlord.kyc_verified) ? 'success' : 'warning'}
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell>{toText(landlord.plots_count) || '0'}</TableCell>
                        <TableCell>{toDisplayDate(landlord.registered)}</TableCell>
                        <TableCell align='right'>
                          <div className='flex justify-end gap-2'>
                            <Button
                              size='small'
                              variant='outlined'
                              disabled={!toBoolean(landlord.kyc_verified) || submitting}
                              onClick={() => openLandlordDialog(landlord, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button size='small' color='error' variant='outlined' disabled={submitting} onClick={() => openLandlordDialog(landlord, 'reject')}>
                              Reject
                            </Button>
                            <Button size='small' color='warning' variant='outlined' disabled={submitting} onClick={() => openLandlordDialog(landlord, 'suspend')}>
                              Suspend
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

      <Grid item xs={12}>
        <Card className='mp-dashboard-section'>
          <CardContent>
            <Typography variant='h5' className='mbe-4'>
              Pending Plots
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Plot</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell>Owner KYC</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Ownership</TableCell>
                    <TableCell>Submitted</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align='center'>
                        <CircularProgress size={22} />
                      </TableCell>
                    </TableRow>
                  ) : plots.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography color='text.secondary'>No pending plots found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    plots.map(plot => (
                      <TableRow key={toText(plot.id)}>
                        <TableCell>
                          <div className='flex flex-col'>
                            <Typography variant='body2'>{toText(plot.plot_name) || '-'}</Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {toText(plot.plot_id) || '-'}
                            </Typography>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-col'>
                            <Typography variant='body2'>{toText(plot.owner?.name) || '-'}</Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {toText(plot.owner?.phone) || toText(plot.owner?.email) || '-'}
                            </Typography>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={toBoolean(plot.owner?.kyc_verified) ? 'verified' : 'pending'}
                            color={toBoolean(plot.owner?.kyc_verified) ? 'success' : 'warning'}
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell>{toText(plot.location) || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={toBoolean(plot.ownership_verified) ? 'verified' : 'pending'}
                            color={toBoolean(plot.ownership_verified) ? 'success' : 'warning'}
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell>{toDisplayDate(plot.submitted_at)}</TableCell>
                        <TableCell align='right'>
                          <div className='flex justify-end gap-2'>
                            <Button size='small' variant='outlined' disabled={submitting} onClick={() => openPlotDialog(plot, 'approve')}>
                              Approve
                            </Button>
                            <Button size='small' color='error' variant='outlined' disabled={submitting} onClick={() => openPlotDialog(plot, 'reject')}>
                              Reject
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

      <Dialog open={dialog.open} onClose={closeDialog} fullWidth maxWidth='sm'>
        <DialogTitle>
          {dialog.entityType === 'landlord' ? 'Landlord Decision' : dialog.entityType === 'plot' ? 'Plot Decision' : 'KYC Document Decision'}
        </DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-4'>
          <TextField
            label='Decision'
            select
            value={dialog.decision}
            onChange={event => setDialog(prev => ({ ...prev, decision: event.target.value }))}
          >
            {dialog.entityType === 'landlord' ? (
              [
                <MenuItem key='approve' value='approve'>
                  Approve
                </MenuItem>,
                <MenuItem key='reject' value='reject'>
                  Reject
                </MenuItem>,
                <MenuItem key='suspend' value='suspend'>
                  Suspend
                </MenuItem>
              ]
            ) : dialog.entityType === 'plot' ? (
              [
                <MenuItem key='approve' value='approve'>
                  Approve
                </MenuItem>,
                <MenuItem key='reject' value='reject'>
                  Reject
                </MenuItem>
              ]
            ) : (
              [
                <MenuItem key='approved' value='approved'>
                  Approve
                </MenuItem>,
                <MenuItem key='resubmit' value='resubmit'>
                  Request Resubmission
                </MenuItem>,
                <MenuItem key='rejected' value='rejected'>
                  Reject
                </MenuItem>
              ]
            )}
          </TextField>

          {dialog.entityType === 'plot' && dialog.decision === 'approve' && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={dialog.ownershipVerified}
                  onChange={event =>
                    setDialog(prev => ({
                      ...prev,
                      ownershipVerified: event.target.checked
                    }))
                  }
                />
              }
              label='I confirm ownership documents were verified for this plot.'
            />
          )}

          <TextField
            label='Notes (optional)'
            multiline
            minRows={3}
            value={dialog.notes}
            onChange={event =>
              setDialog(prev => ({
                ...prev,
                notes: event.target.value
              }))
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submitDecision} variant='contained' disabled={submitting}>
            {submitting ? <CircularProgress size={20} color='inherit' /> : 'Save Decision'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default LandlordVerificationAdminView
