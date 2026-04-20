'use client'

import { useEffect, useMemo, useState } from 'react'

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

import { useRealtimeModuleData } from '@/hooks/useRealtimeModuleData'

const toText = value => String(value || '').trim()

const toNumber = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

const normalizeStatus = value => toText(value).toLowerCase()

const statusColor = status => {
  const normalized = normalizeStatus(status)

  if (['active', 'approved', 'trial'].includes(normalized)) {
    return 'success'
  }

  if (['pending', 'pending review'].includes(normalized)) {
    return 'warning'
  }

  if (['rejected', 'inactive', 'expired', 'cancelled'].includes(normalized)) {
    return 'error'
  }

  return 'default'
}

const formatKES = value => `KES ${Math.max(0, Number(value || 0)).toLocaleString('en-KE')}`

const parseFeaturesInput = value =>
  String(value || '')
    .split('\n')
    .flatMap(item => item.split(','))
    .map(item => toText(item))
    .filter(Boolean)

const stringifyFeatures = value => (Array.isArray(value) ? value.join('\n') : '')

const INITIAL_SUBSCRIPTION_FORM = {
  decision: 'approve',
  nextPlan: '',
  status: 'active',
  note: ''
}

const INITIAL_PLAN_FORM = {
  planName: '',
  planCode: '',
  audience: 'tenant',
  featureKey: '',
  billingCycle: 'monthly',
  amount: '',
  currency: 'KES',
  durationDays: '',
  sortOrder: '0',
  active: 'true',
  description: '',
  featuresText: '',
  note: ''
}

const audienceLabel = audience => {
  const normalized = normalizeStatus(audience)

  if (normalized === 'landlord_agent') {
    return 'Landlord + Agent'
  }

  if (normalized === 'tenant') {
    return 'Tenant'
  }

  if (normalized === 'landlord') {
    return 'Landlord'
  }

  if (normalized === 'agent') {
    return 'Agent'
  }

  return toText(audience) || 'Platform'
}

const billingLabel = billingCycle => {
  const normalized = normalizeStatus(billingCycle)

  if (normalized === 'yearly') {
    return 'Yearly'
  }

  if (normalized === 'monthly') {
    return 'Monthly'
  }

  if (normalized === 'one_time') {
    return 'One time'
  }

  return toText(billingCycle) || '-'
}

const isMeaningfulPlanValue = value => {
  const normalized = normalizeStatus(value)

  return Boolean(normalized && normalized !== '-' && normalized !== 'plan')
}

const findPlanMatch = (planRows, value) => {
  const normalized = normalizeStatus(value)

  if (!normalized) {
    return null
  }

  return (
    planRows.find(plan => normalizeStatus(plan?.id) === normalized) ||
    planRows.find(plan => normalizeStatus(plan?.planCode) === normalized) ||
    planRows.find(plan => normalizeStatus(plan?.featureKey) === normalized) ||
    planRows.find(plan => normalizeStatus(plan?.planName) === normalized) ||
    null
  )
}

const resolveQueuePlanLabel = (planRows, codeOrId, fallbackLabel) => {
  const matchedPlan = findPlanMatch(planRows, codeOrId || fallbackLabel)

  if (matchedPlan) {
    return toText(matchedPlan?.planName) || toText(matchedPlan?.planCode) || toText(fallbackLabel) || '-'
  }

  return toText(fallbackLabel) || toText(codeOrId) || '-'
}

const SubscriptionsPlansAdminView = ({ initialData }) => {
  const [openDecisionDialog, setOpenDecisionDialog] = useState(false)
  const [openPlanDialog, setOpenPlanDialog] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)
  const [subscriptionFormValues, setSubscriptionFormValues] = useState(INITIAL_SUBSCRIPTION_FORM)
  const [planFormValues, setPlanFormValues] = useState(INITIAL_PLAN_FORM)
  const [submitError, setSubmitError] = useState('')
  const [plansError, setPlansError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [plansLoading, setPlansLoading] = useState(true)
  const [planRows, setPlanRows] = useState([])

  const { rows, isRefreshing, refreshNow } = useRealtimeModuleData({
    moduleKey: 'subscriptions',
    initialRows: initialData?.rows || [],
    initialStats: initialData?.stats || [],
    initialDataSource: initialData?.dataSource || 'live'
  })

  const loadPlans = async () => {
    try {
      setPlansLoading(true)
      setPlansError('')

      const response = await fetch('/api/admin/subscription-plans', {
        method: 'GET',
        cache: 'no-store'
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load subscription plans.')
      }

      setPlanRows(Array.isArray(payload?.plans) ? payload.plans : [])
    } catch (error) {
      setPlansError(error?.message || 'Unable to load subscription plans.')
    } finally {
      setPlansLoading(false)
    }
  }

  useEffect(() => {
    loadPlans()
  }, [])

  const refreshAll = async () => {
    await Promise.all([refreshNow(), loadPlans()])
  }

  const stats = useMemo(() => {
    const activePlans = planRows.filter(plan => plan?.active !== false).length
    const yearlyPlans = planRows.filter(plan => normalizeStatus(plan?.billingCycle) === 'yearly').length
    const monthlyPlans = planRows.filter(plan => normalizeStatus(plan?.billingCycle) === 'monthly').length

    const activeSubscriptions = rows.filter(
      row => normalizeStatus(row?.status) === 'active' && isMeaningfulPlanValue(row?.planCode || row?.plan)
    ).length

    return [
      { label: 'Active Plans', value: String(activePlans), hint: 'Pricing plans available right now' },
      { label: 'Yearly Plans', value: String(yearlyPlans), hint: 'Landlord and agent subscriptions' },
      { label: 'Monthly Plans', value: String(monthlyPlans), hint: 'Tenant-facing subscriptions' },
      { label: 'Active Subscriptions', value: String(activeSubscriptions), hint: 'Approved active subscriptions' }
    ]
  }, [planRows, rows])

  const queueRows = useMemo(
    () =>
      rows.filter(row => {
        const hasRequestedPlan = isMeaningfulPlanValue(row?.requestedPlanCode || row?.requestedPlan)
        const status = normalizeStatus(row?.status)

        if (hasRequestedPlan) {
          return true
        }

        return !['trial', 'active', 'approved'].includes(status)
      }),
    [rows]
  )

  const closeDecisionDialog = () => {
    setOpenDecisionDialog(false)
    setSelectedRow(null)
    setSubscriptionFormValues(INITIAL_SUBSCRIPTION_FORM)
    setSubmitError('')
  }

  const availableQueuePlans = useMemo(
    () =>
      planRows.filter(plan => {
        const audience = normalizeStatus(plan?.audience)

        return ['landlord', 'agent', 'landlord_agent'].includes(audience)
      }),
    [planRows]
  )

  const openQueueDecisionDialog = (row, decision) => {
    const requestedPlanCode = toText(row?.requestedPlanCode)
    const currentPlanCode = toText(row?.planCode || row?.planId)
    const firstAvailablePlan = toText(availableQueuePlans[0]?.planCode)

    const defaultPlan = isMeaningfulPlanValue(requestedPlanCode)
      ? requestedPlanCode
      : isMeaningfulPlanValue(currentPlanCode)
        ? currentPlanCode
        : firstAvailablePlan

    setSelectedRow(row)
    setSubscriptionFormValues({
      decision,
      nextPlan: defaultPlan,
      status: decision === 'approve' ? 'active' : 'rejected',
      note: ''
    })
    setSubmitError('')
    setSuccessMessage('')
    setOpenDecisionDialog(true)
  }

  const closePlanDialog = () => {
    setOpenPlanDialog(false)
    setEditingPlan(null)
    setPlanFormValues(INITIAL_PLAN_FORM)
    setSubmitError('')
  }

  const openCreatePlanDialog = () => {
    setEditingPlan(null)
    setPlanFormValues(INITIAL_PLAN_FORM)
    setSubmitError('')
    setSuccessMessage('')
    setOpenPlanDialog(true)
  }

  const openEditPlanDialog = plan => {
    setEditingPlan(plan)
    setPlanFormValues({
      planName: toText(plan?.planName),
      planCode: toText(plan?.planCode),
      audience: toText(plan?.audience || 'tenant'),
      featureKey: toText(plan?.featureKey),
      billingCycle: toText(plan?.billingCycle || 'monthly'),
      amount: toText(plan?.amount),
      currency: toText(plan?.currency || 'KES') || 'KES',
      durationDays: toText(plan?.durationDays),
      sortOrder: toText(plan?.sortOrder || '0'),
      active: plan?.active === false ? 'false' : 'true',
      description: toText(plan?.description),
      featuresText: stringifyFeatures(plan?.features),
      note: ''
    })
    setSubmitError('')
    setSuccessMessage('')
    setOpenPlanDialog(true)
  }

  const handleSubmitDecision = async () => {
    const identifier = toText(selectedRow?.recordId || selectedRow?.subscriptionId)

    if (!identifier) {
      setSubmitError('Subscription identifier is missing for this row.')

      return
    }

    if (subscriptionFormValues.decision === 'approve' && !toText(subscriptionFormValues.nextPlan)) {
      setSubmitError('Choose the landlord plan to apply before approving this request.')

      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch(`/api/admin/subscriptions/${encodeURIComponent(identifier)}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionFormValues)
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to save subscription decision.')
      }

      setSuccessMessage(`Subscription ${toText(payload?.decision || subscriptionFormValues.decision)} successfully.`)
      closeDecisionDialog()
      await refreshAll()
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save subscription decision.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitPlan = async () => {
    const payload = {
      planName: toText(planFormValues.planName),
      planCode: toText(planFormValues.planCode).toLowerCase(),
      audience: toText(planFormValues.audience || 'tenant'),
      featureKey: toText(planFormValues.featureKey).toLowerCase(),
      billingCycle: toText(planFormValues.billingCycle || 'monthly'),
      amount: toNumber(planFormValues.amount),
      currency: toText(planFormValues.currency || 'KES') || 'KES',
      durationDays: toNumber(planFormValues.durationDays),
      sortOrder: toNumber(planFormValues.sortOrder) ?? 0,
      active: planFormValues.active !== 'false',
      description: toText(planFormValues.description),
      features: parseFeaturesInput(planFormValues.featuresText),
      note: toText(planFormValues.note)
    }

    if (!payload.planName || !payload.planCode || !payload.featureKey || payload.amount === null || payload.durationDays === null) {
      setSubmitError('Plan name, code, access key, amount, and duration are required.')

      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const isEdit = Boolean(editingPlan?.id || editingPlan?.planCode)
      const identifier = toText(editingPlan?.id || editingPlan?.planCode)

      const endpoint = isEdit
        ? `/api/admin/subscription-plans/${encodeURIComponent(identifier)}`
        : '/api/admin/subscription-plans'

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
        throw new Error(responseBody?.error || 'Unable to save subscription plan.')
      }

      setSuccessMessage(isEdit ? 'Subscription plan updated successfully.' : 'Subscription plan created successfully.')
      closePlanDialog()
      await refreshAll()
    } catch (error) {
      setSubmitError(error?.message || 'Unable to save subscription plan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickPlanToggle = async plan => {
    const identifier = toText(plan?.id || plan?.planCode)

    if (!identifier) {
      setSubmitError('Plan identifier is missing for this row.')

      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch(`/api/admin/subscription-plans/${encodeURIComponent(identifier)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          active: plan?.active === false,
          note: 'Quick status toggle from admin catalog'
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to update plan status.')
      }

      setSuccessMessage(`Plan ${plan?.active === false ? 'activated' : 'deactivated'} successfully.`)
      await loadPlans()
    } catch (error) {
      setSubmitError(error?.message || 'Unable to update plan status.')
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
                <Typography variant='h4'>Subscriptions & Plans</Typography>
                <Chip
                  label={isRefreshing || plansLoading ? 'Syncing...' : 'Live Data'}
                  color={isRefreshing || plansLoading ? 'info' : 'success'}
                  variant='tonal'
                  size='small'
                />
              </div>
              <Typography className='text-textSecondary'>
                Control pricing in the database, then review landlord subscription changes from the same admin workspace.
              </Typography>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Button variant='outlined' startIcon={<i className='ri-refresh-line' />} onClick={refreshAll}>
                Refresh
              </Button>
              <Button variant='contained' startIcon={<i className='ri-add-line' />} onClick={openCreatePlanDialog}>
                Add Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {(submitError || plansError || successMessage) && (
        <Grid item xs={12}>
          {submitError && (
            <Alert severity='error' variant='tonal'>
              {submitError}
            </Alert>
          )}
          {!submitError && plansError && (
            <Alert severity='warning' variant='tonal'>
              {plansError}
            </Alert>
          )}
          {!submitError && !plansError && successMessage && (
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
            <div className='flex items-center justify-between gap-4 mbe-4'>
              <div>
                <Typography variant='h5'>Plan Catalog</Typography>
                <Typography color='text.secondary'>
                  These plans drive pricing on the public page and the subscription APIs.
                </Typography>
              </div>
            </div>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Plan</TableCell>
                    <TableCell>Audience</TableCell>
                    <TableCell>Access</TableCell>
                    <TableCell>Billing</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plansLoading ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className='flex items-center gap-2'>
                          <CircularProgress size={18} />
                          <Typography color='text.secondary'>Loading pricing plans...</Typography>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : !planRows.length ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <Typography color='text.secondary'>No subscription plans found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    planRows.map(plan => (
                      <TableRow key={toText(plan?.id || plan?.planCode)}>
                        <TableCell>
                          <div className='flex flex-col'>
                            <Typography variant='body2'>{toText(plan?.planName) || '-'}</Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {toText(plan?.planCode) || '-'}
                            </Typography>
                          </div>
                        </TableCell>
                        <TableCell>{audienceLabel(plan?.audience)}</TableCell>
                        <TableCell>{toText(plan?.featureKey) || '-'}</TableCell>
                        <TableCell>
                          {billingLabel(plan?.billingCycle)} / {toText(plan?.durationDays) || '0'} days
                        </TableCell>
                        <TableCell>{formatKES(plan?.amount)}</TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={plan?.active === false ? 'inactive' : 'active'}
                            color={statusColor(plan?.active === false ? 'inactive' : 'active')}
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell align='right'>
                          <div className='flex justify-end gap-2'>
                            <Button size='small' variant='outlined' onClick={() => openEditPlanDialog(plan)}>
                              Edit
                            </Button>
                            <Button size='small' variant='outlined' onClick={() => handleQuickPlanToggle(plan)} disabled={isSubmitting}>
                              {plan?.active === false ? 'Activate' : 'Deactivate'}
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
              Subscription Queue
            </Typography>
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Subscription ID</TableCell>
                    <TableCell>Landlord</TableCell>
                    <TableCell>Current Plan</TableCell>
                    <TableCell>Requested Plan</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Billing Period</TableCell>
                    <TableCell>Last Updated</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!queueRows.length ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <Typography color='text.secondary'>No pending subscription changes found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    queueRows.map(row => {
                      const key = toText(row?.recordId || row?.subscriptionId) || `${row?.subscriptionId}-${row?.updatedAt}`

                      const hasPendingChange =
                        isMeaningfulPlanValue(row?.requestedPlanCode || row?.requestedPlan) || normalizeStatus(row?.status) === 'pending'

                      return (
                        <TableRow key={key}>
                          <TableCell>{toText(row?.subscriptionId) || '-'}</TableCell>
                          <TableCell>{toText(row?.owner) || '-'}</TableCell>
                          <TableCell>{resolveQueuePlanLabel(planRows, row?.planCode || row?.planId, row?.plan)}</TableCell>
                          <TableCell>{resolveQueuePlanLabel(planRows, row?.requestedPlanCode, row?.requestedPlan)}</TableCell>
                          <TableCell>
                            <Chip size='small' label={toText(row?.status) || '-'} color={statusColor(row?.status)} variant='tonal' />
                          </TableCell>
                          <TableCell>{toText(row?.period) || '-'}</TableCell>
                          <TableCell>{toText(row?.updatedAt) || '-'}</TableCell>
                          <TableCell align='right'>
                            <div className='flex justify-end gap-2'>
                              <Button
                                size='small'
                                variant='outlined'
                                onClick={() => openQueueDecisionDialog(row, 'approve')}
                                disabled={!hasPendingChange}
                              >
                                Approve
                              </Button>
                              <Button
                                size='small'
                                color='error'
                                variant='outlined'
                                onClick={() => openQueueDecisionDialog(row, 'reject')}
                                disabled={!hasPendingChange}
                              >
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={openPlanDialog} onClose={closePlanDialog} fullWidth maxWidth='sm'>
        <DialogTitle>{editingPlan ? 'Edit Subscription Plan' : 'Add Subscription Plan'}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-4'>
          <TextField
            label='Plan Name'
            value={planFormValues.planName}
            onChange={event => setPlanFormValues(prev => ({ ...prev, planName: event.target.value }))}
          />
          <TextField
            label='Plan Code'
            value={planFormValues.planCode}
            onChange={event => setPlanFormValues(prev => ({ ...prev, planCode: event.target.value }))}
            helperText='Example: tenant_house_search'
          />
          <TextField
            label='Audience'
            select
            value={planFormValues.audience}
            onChange={event => setPlanFormValues(prev => ({ ...prev, audience: event.target.value }))}
          >
            <MenuItem value='tenant'>tenant</MenuItem>
            <MenuItem value='landlord_agent'>landlord_agent</MenuItem>
            <MenuItem value='landlord'>landlord</MenuItem>
            <MenuItem value='agent'>agent</MenuItem>
            <MenuItem value='platform'>platform</MenuItem>
          </TextField>
          <TextField
            label='Access Key'
            value={planFormValues.featureKey}
            onChange={event => setPlanFormValues(prev => ({ ...prev, featureKey: event.target.value }))}
            helperText='Example: house_search, marketplace_listing, management_module, full_access'
          />
          <TextField
            label='Billing Cycle'
            select
            value={planFormValues.billingCycle}
            onChange={event => setPlanFormValues(prev => ({ ...prev, billingCycle: event.target.value }))}
          >
            <MenuItem value='monthly'>monthly</MenuItem>
            <MenuItem value='yearly'>yearly</MenuItem>
            <MenuItem value='one_time'>one_time</MenuItem>
          </TextField>
          <TextField
            label='Amount (KES)'
            type='number'
            value={planFormValues.amount}
            onChange={event => setPlanFormValues(prev => ({ ...prev, amount: event.target.value }))}
          />
          <TextField
            label='Duration (days)'
            type='number'
            value={planFormValues.durationDays}
            onChange={event => setPlanFormValues(prev => ({ ...prev, durationDays: event.target.value }))}
          />
          <TextField
            label='Sort Order'
            type='number'
            value={planFormValues.sortOrder}
            onChange={event => setPlanFormValues(prev => ({ ...prev, sortOrder: event.target.value }))}
          />
          <TextField
            label='Status'
            select
            value={planFormValues.active}
            onChange={event => setPlanFormValues(prev => ({ ...prev, active: event.target.value }))}
          >
            <MenuItem value='true'>active</MenuItem>
            <MenuItem value='false'>inactive</MenuItem>
          </TextField>
          <TextField
            label='Description'
            multiline
            minRows={2}
            value={planFormValues.description}
            onChange={event => setPlanFormValues(prev => ({ ...prev, description: event.target.value }))}
          />
          <TextField
            label='Plan Features'
            multiline
            minRows={4}
            value={planFormValues.featuresText}
            onChange={event => setPlanFormValues(prev => ({ ...prev, featuresText: event.target.value }))}
            helperText='Enter one feature per line, or separate with commas.'
          />
          <TextField
            label='Internal Note (optional)'
            multiline
            minRows={2}
            value={planFormValues.note}
            onChange={event => setPlanFormValues(prev => ({ ...prev, note: event.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closePlanDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitPlan} variant='contained' disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} color='inherit' /> : editingPlan ? 'Save Changes' : 'Create Plan'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDecisionDialog} onClose={closeDecisionDialog} fullWidth maxWidth='sm'>
        <DialogTitle>{subscriptionFormValues.decision === 'approve' ? 'Approve Plan Change' : 'Reject Plan Change'}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-4'>
          <TextField
            label='Decision'
            select
            value={subscriptionFormValues.decision}
            onChange={event =>
              setSubscriptionFormValues(prev => ({
                ...prev,
                decision: event.target.value,
                status: event.target.value === 'approve' ? 'active' : 'rejected'
              }))
            }
          >
            <MenuItem value='approve'>Approve</MenuItem>
            <MenuItem value='reject'>Reject</MenuItem>
          </TextField>
          <TextField
            label='Plan To Apply'
            select
            value={subscriptionFormValues.nextPlan}
            onChange={event => setSubscriptionFormValues(prev => ({ ...prev, nextPlan: event.target.value }))}
            helperText='Choose the real landlord plan that should become active after approval.'
          >
            {availableQueuePlans.map(plan => (
              <MenuItem key={toText(plan?.id || plan?.planCode)} value={toText(plan?.planCode)}>
                {toText(plan?.planName) || toText(plan?.planCode)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label='Status'
            select
            value={subscriptionFormValues.status}
            onChange={event => setSubscriptionFormValues(prev => ({ ...prev, status: event.target.value }))}
          >
            <MenuItem value='active'>active</MenuItem>
            <MenuItem value='trial'>trial</MenuItem>
            <MenuItem value='pending'>pending</MenuItem>
            <MenuItem value='rejected'>rejected</MenuItem>
            <MenuItem value='inactive'>inactive</MenuItem>
          </TextField>
          <TextField
            label='Note (optional)'
            multiline
            minRows={3}
            value={subscriptionFormValues.note}
            onChange={event => setSubscriptionFormValues(prev => ({ ...prev, note: event.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDecisionDialog} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitDecision} variant='contained' disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={20} color='inherit' /> : 'Save Decision'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default SubscriptionsPlansAdminView
