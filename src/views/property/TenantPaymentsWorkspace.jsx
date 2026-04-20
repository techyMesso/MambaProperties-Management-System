'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'

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
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import tableStyles from '@core/styles/table.module.css'

const PAYMENT_METHODS = [
  { value: 'mpesa', label: 'M-Pesa STK Push' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card', label: 'Card Payment' },
  { value: 'cash', label: 'Cash Deposit' },
  { value: 'other', label: 'Other Method' }
]

const toAmount = value => {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}

const formatKES = value => `KES ${Math.max(0, toAmount(value)).toLocaleString('en-KE')}`

const getChipColor = status => {
  const normalized = String(status || '').toLowerCase()

  if (normalized.includes('paid') || normalized.includes('completed') || normalized.includes('active')) {
    return 'success'
  }

  if (normalized.includes('partial') || normalized.includes('pending') || normalized.includes('review')) {
    return 'warning'
  }

  if (normalized.includes('arrears') || normalized.includes('overdue') || normalized.includes('failed')) {
    return 'error'
  }

  return 'info'
}

const defaultContext = {
  tenantName: 'Tenant',
  invoices: [],
  recentPayments: [],
  landlords: [],
  subscription: {
    required: true,
    hasAccess: false,
    status: 'none',
    paymentStatus: 'unpaid',
    amountDue: 0,
    currency: 'KES',
    expiresAt: null
  },
  profilePhone: '',
  dataSource: 'sample'
}

const createDefaultPaymentForm = (invoice, tenantName) => ({
  method: 'mpesa',
  amount: String(Math.max(0, Math.round((invoice?.outstandingAmount || invoice?.dueAmount || 0) * 100) / 100)),
  phoneNumber: '',
  payerName: tenantName || invoice?.tenantName || 'Tenant',
  accountReference: invoice?.invoiceNo || '',
  notes: '',
  proofFile: null
})

const sanitizeReturnPath = value => {
  const raw = String(value || '').trim()

  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return '/marketplace?intent=search'
  }

  return raw
}

const getSubscriptionStage = subscription => {
  const status = String(subscription?.status || '')
    .trim()
    .toLowerCase()

  const paymentStatus = String(subscription?.paymentStatus || '')
    .trim()
    .toLowerCase()

  const hasAccess = subscription?.hasAccess === true

  if (hasAccess) {
    return {
      label: 'Access active',
      color: 'success',
      helper: 'Marketplace access is now unlocked.'
    }
  }

  if (status === 'pending' && paymentStatus === 'unpaid') {
    return {
      label: 'Awaiting payment',
      color: 'warning',
      helper: 'The subscription request exists, but payment is still being confirmed.'
    }
  }

  if (status === 'pending') {
    return {
      label: 'Pending activation',
      color: 'info',
      helper: 'We are waiting for the provider callback before activating marketplace access.'
    }
  }

  if (status === 'none') {
    return {
      label: 'Not started',
      color: 'default',
      helper: 'Start the house-search subscription when you are ready to browse listings.'
    }
  }

  return {
    label: status || 'Unknown',
    color: 'default',
    helper: 'Refresh this page if the status does not update after payment.'
  }
}

const TenantPaymentsWorkspace = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [context, setContext] = useState(defaultContext)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [openDialog, setOpenDialog] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [paymentForm, setPaymentForm] = useState(createDefaultPaymentForm(null, defaultContext.tenantName))
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [subscriptionPhone, setSubscriptionPhone] = useState('')
  const [isInitiatingSubscription, setIsInitiatingSubscription] = useState(false)
  const [intentHandled, setIntentHandled] = useState(false)
  const [redirectHandled, setRedirectHandled] = useState(false)
  const [subscriptionPollCountdown, setSubscriptionPollCountdown] = useState(10)

  const loadContext = useCallback(async ({ withLoading = false } = {}) => {
    if (withLoading) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setLoadError('')

    try {
      const response = await fetch('/api/tenant/payments/context', {
        method: 'GET',
        cache: 'no-store'
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load payment context.')
      }

      setContext({
        tenantName: payload?.tenantName || 'Tenant',
        invoices: Array.isArray(payload?.invoices) ? payload.invoices : [],
        recentPayments: Array.isArray(payload?.recentPayments) ? payload.recentPayments : [],
        landlords: Array.isArray(payload?.landlords) ? payload.landlords : [],
        subscription:
          payload?.subscription && typeof payload.subscription === 'object'
            ? payload.subscription
            : defaultContext.subscription,
        profilePhone: String(payload?.profilePhone || '').trim(),
        dataSource: payload?.dataSource || 'live'
      })

      setSubscriptionPhone(current => current || String(payload?.profilePhone || '').trim())
    } catch (error) {
      setLoadError(error?.message || 'Unable to load payment context.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadContext({ withLoading: true })
  }, [loadContext])

  const subscriptionRequired = searchParams?.get('subscription') === 'required'

  // Support both 'next' and 'returnTo' parameters for redirect after subscription
  // 'next' takes precedence for consistency with Login page
  const nextParam = searchParams?.get('next')
  const returnToParam = searchParams?.get('returnTo')
  const returnTo = sanitizeReturnPath(nextParam || returnToParam || '/marketplace?intent=search')
  const subscriptionStage = getSubscriptionStage(context.subscription)

  const isWaitingForSubscriptionActivation =
    subscriptionRequired &&
    !context.subscription?.hasAccess &&
    (context.subscription?.status === 'pending' || context.subscription?.paymentStatus === 'unpaid')

  const openPayDialog = useCallback(
    invoice => {
      setSelectedInvoice(invoice)
      setPaymentForm(createDefaultPaymentForm(invoice, context.tenantName))
      setSubmitError('')
      setSuccessMessage('')
      setOpenDialog(true)
    },
    [context.tenantName]
  )

  useEffect(() => {
    if (intentHandled || loading) {
      return
    }

    const intent = String(searchParams?.get('intent') || '')
      .trim()
      .toLowerCase()

    if (intent !== 'pay-rent') {
      setIntentHandled(true)

      return
    }

    const targetInvoice =
      context.invoices.find(item => toAmount(item?.outstandingAmount) > 0) ||
      context.invoices.find(
        item =>
          !String(item?.status || '')
            .toLowerCase()
            .includes('paid')
      ) ||
      context.invoices[0]

    if (targetInvoice) {
      openPayDialog(targetInvoice)
    }

    setIntentHandled(true)
  }, [context.invoices, intentHandled, loading, openPayDialog, searchParams])

  useEffect(() => {
    if (loading || redirectHandled || !context.subscription?.hasAccess) {
      return
    }

    if (!subscriptionRequired) {
      return
    }

    setRedirectHandled(true)
    setSuccessMessage(prev => prev || 'Subscription confirmed. Redirecting you back to marketplace.')

    const timer = window.setTimeout(() => {
      router.replace(returnTo)
    }, 1200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [context.subscription?.hasAccess, loading, redirectHandled, returnTo, router, subscriptionRequired])

  useEffect(() => {
    if (!subscriptionRequired) {
      return undefined
    }

    const isAwaitingConfirmation =
      context.subscription?.status === 'pending' || context.subscription?.paymentStatus === 'unpaid'

    if (!isAwaitingConfirmation || context.subscription?.hasAccess) {
      return undefined
    }

    setSubscriptionPollCountdown(10)

    const countdownInterval = window.setInterval(() => {
      setSubscriptionPollCountdown(current => {
        if (current <= 1) {
          return 10
        }

        return current - 1
      })
    }, 1000)

    const intervalId = window.setInterval(() => {
      void loadContext({ withLoading: false })
    }, 10000)

    return () => {
      window.clearInterval(countdownInterval)
      window.clearInterval(intervalId)
    }
  }, [
    context.subscription?.hasAccess,
    context.subscription?.paymentStatus,
    context.subscription?.status,
    loadContext,
    subscriptionRequired
  ])

  const summary = useMemo(() => {
    const due = context.invoices.reduce((total, item) => total + toAmount(item?.dueAmount), 0)
    const paid = context.invoices.reduce((total, item) => total + toAmount(item?.paidAmount), 0)
    const outstanding = context.invoices.reduce((total, item) => total + toAmount(item?.outstandingAmount), 0)
    const pendingCount = context.invoices.filter(item => toAmount(item?.outstandingAmount) > 0).length

    return {
      due,
      paid,
      outstanding,
      pendingCount
    }
  }, [context.invoices])

  const handleRefresh = () => {
    loadContext({ withLoading: false })
  }

  const handleInitiateSubscription = async () => {
    const phoneNumber = String(subscriptionPhone || '').trim()

    if (phoneNumber.length < 9) {
      setLoadError('Enter a valid phone number to initiate tenant subscription.')

      return
    }

    setIsInitiatingSubscription(true)
    setLoadError('')
    setSuccessMessage('')

    try {
      const response = await fetch('/api/tenant/subscriptions/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscriptionType: 'house_search',
          phoneNumber
        })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to start tenant subscription.')
      }

      if (payload?.nextAction === 'enter_pin' || payload?.status === 'pending_payment') {
        setSuccessMessage(
          payload?.customerMessage ||
            'Subscription request is pending payment confirmation. Once payment confirms, we will take you back to marketplace automatically.'
        )
      } else if (payload?.paymentError) {
        throw new Error(payload.paymentError)
      } else {
        setSuccessMessage(
          payload?.message || 'Subscription request was saved, but no M-Pesa STK prompt has been confirmed yet.'
        )
      }

      await loadContext({ withLoading: false })
    } catch (error) {
      setLoadError(error?.message || 'Unable to start tenant subscription.')
    } finally {
      setIsInitiatingSubscription(false)
    }
  }

  const handleFormChange = (field, value) => {
    setPaymentForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const uploadProofFile = async file => {
    const formData = new FormData()

    formData.set('file', file)
    formData.set('moduleKey', 'payments')

    const response = await fetch('/api/storage/documents/upload', {
      method: 'POST',
      body: formData
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok || !payload?.path) {
      throw new Error(payload?.error || 'Unable to upload proof document.')
    }

    return payload.path
  }

  const handleSubmitPayment = async () => {
    if (!selectedInvoice?.id || !selectedInvoice?.ownerId) {
      setSubmitError('Select a valid invoice before submitting payment.')

      return
    }

    const amount = toAmount(paymentForm.amount)

    if (amount <= 0) {
      setSubmitError('Enter a valid payment amount.')

      return
    }

    if (paymentForm.method === 'mpesa' && !String(paymentForm.phoneNumber || '').trim()) {
      setSubmitError('Phone number is required for M-Pesa STK push.')

      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    setSuccessMessage('')

    try {
      let proofPath = null

      if (paymentForm.proofFile) {
        proofPath = await uploadProofFile(paymentForm.proofFile)
      }

      if (paymentForm.method === 'mpesa') {
        const response = await fetch('/api/payments/mpesa/stk-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ownerId: selectedInvoice.ownerId,
            invoiceId: selectedInvoice.id,
            tenantName: selectedInvoice.tenantName || context.tenantName,
            amount,
            phoneNumber: paymentForm.phoneNumber,
            accountReference: paymentForm.accountReference || selectedInvoice.invoiceNo,
            description: paymentForm.notes || `Rent payment for ${selectedInvoice.invoiceNo || 'invoice'}`,
            proofPath,
            payerName: paymentForm.payerName,
            payerPhone: paymentForm.phoneNumber
          })
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to initiate M-Pesa payment.')
        }

        setSuccessMessage(payload?.customerMessage || 'M-Pesa STK prompt sent successfully.')
      } else {
        const response = await fetch('/api/tenant/payments/manual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ownerId: selectedInvoice.ownerId,
            invoiceId: selectedInvoice.id,
            method: paymentForm.method,
            amount,
            payerName: paymentForm.payerName || context.tenantName,
            payerPhone: paymentForm.phoneNumber || null,
            accountReference: paymentForm.accountReference || selectedInvoice.invoiceNo,
            notes: paymentForm.notes || null,
            proofPath
          })
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to submit payment details.')
        }

        setSuccessMessage(payload?.message || 'Payment details submitted for landlord verification.')
      }

      setOpenDialog(false)
      await loadContext({ withLoading: false })
    } catch (error) {
      setSubmitError(error?.message || 'Unable to submit payment.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='flex items-center gap-3'>
          <CircularProgress size={20} />
          <Typography>Loading rent payment workspace...</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Card className='mp-dashboard-hero'>
            <CardContent className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <div className='flex items-center gap-2'>
                  <Typography variant='h4'>Pay Rent & Manage Invoices</Typography>
                  <Chip
                    label={refreshing ? 'Syncing...' : 'Live Data'}
                    color={refreshing ? 'info' : 'success'}
                    variant='tonal'
                    size='small'
                  />
                </div>
                <Typography className='text-textSecondary'>
                  Submit rent payments, upload payment proofs, and download invoice copies from one secure tenant
                  workflow.
                </Typography>
              </div>
              <div className='flex flex-wrap gap-3'>
                <Button variant='outlined' startIcon={<i className='ri-refresh-line' />} onClick={handleRefresh}>
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {loadError && (
          <Grid item xs={12}>
            <Alert severity='error'>{loadError}</Alert>
          </Grid>
        )}

        {successMessage && (
          <Grid item xs={12}>
            <Alert severity='success' variant='tonal'>
              {successMessage}
            </Alert>
          </Grid>
        )}

        {isWaitingForSubscriptionActivation && (
          <Grid item xs={12}>
            <Alert severity='info' variant='tonal'>
              Waiting for M-Pesa confirmation. We will check again in about {subscriptionPollCountdown} second
              {subscriptionPollCountdown === 1 ? '' : 's'} and return you to marketplace automatically once access is
              active.
            </Alert>
          </Grid>
        )}

        {!context.subscription?.hasAccess && (
          <Grid item xs={12}>
            <Card className='mp-dashboard-section'>
              <CardContent className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
                <div className='flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Typography variant='h5'>Tenant Subscription Required</Typography>
                    <Chip
                      label={subscriptionStage.label}
                      color={subscriptionStage.color}
                      variant='tonal'
                      size='small'
                    />
                  </div>
                  <Typography color='text.secondary'>
                    Activate your House Search subscription to unlock marketplace access after sign-up and email
                    verification.
                  </Typography>
                  <Typography variant='body2' color='text.secondary' className='mt-2'>
                    Status: {String(context.subscription?.status || 'none')} | Payment:{' '}
                    {String(context.subscription?.paymentStatus || 'unpaid')}
                  </Typography>
                  <Typography variant='body2' color='text.secondary' className='mt-2'>
                    {subscriptionStage.helper}
                  </Typography>
                </div>
                <div className='flex w-full flex-col gap-3 sm:w-auto sm:min-w-[320px]'>
                  <TextField
                    fullWidth
                    label='M-Pesa Phone Number'
                    placeholder='+2547XXXXXXXX'
                    value={subscriptionPhone}
                    onChange={event => setSubscriptionPhone(event.target.value)}
                  />
                  <Button variant='contained' onClick={handleInitiateSubscription} disabled={isInitiatingSubscription}>
                    {isInitiatingSubscription ? 'Starting...' : 'Start House Search Subscription'}
                  </Button>
                  {context.subscription?.hasAccess ? (
                    <Button variant='outlined' onClick={() => router.replace(returnTo)}>
                      Continue to Marketplace
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid item xs={12} sm={6} md={3}>
          <Card className='mp-dashboard-kpi'>
            <CardContent>
              <Typography className='text-textSecondary'>Total Invoiced</Typography>
              <Typography variant='h4'>{formatKES(summary.due)}</Typography>
              <Typography variant='body2'>All invoices in your account</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className='mp-dashboard-kpi'>
            <CardContent>
              <Typography className='text-textSecondary'>Paid Amount</Typography>
              <Typography variant='h4'>{formatKES(summary.paid)}</Typography>
              <Typography variant='body2'>Confirmed paid and partial payments</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className='mp-dashboard-kpi'>
            <CardContent>
              <Typography className='text-textSecondary'>Outstanding Balance</Typography>
              <Typography variant='h4'>{formatKES(summary.outstanding)}</Typography>
              <Typography variant='body2'>Remaining due amount</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className='mp-dashboard-kpi'>
            <CardContent>
              <Typography className='text-textSecondary'>Invoices Pending</Typography>
              <Typography variant='h4'>{summary.pendingCount}</Typography>
              <Typography variant='body2'>Invoices requiring action</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card className='mp-dashboard-section'>
            <CardContent>
              <div className='flex items-center justify-between gap-4 mbe-4'>
                <Typography variant='h5'>{`${context.tenantName}'s Invoices`}</Typography>
                <Chip label={`${context.invoices.length} Invoices`} color='primary' variant='tonal' size='small' />
              </div>
              <div className='overflow-x-auto'>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Landlord</th>
                      <th>Period</th>
                      <th>Due</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {context.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <Typography color='text.secondary'>
                            No invoice records were found for your account yet.
                          </Typography>
                        </td>
                      </tr>
                    ) : (
                      context.invoices.map(invoice => {
                        const hasOutstanding = toAmount(invoice.outstandingAmount) > 0

                        return (
                          <tr key={invoice.id || `${invoice.ownerId}-${invoice.invoiceNo}`}>
                            <td>
                              <Typography color='text.primary'>{invoice.invoiceNo || 'Invoice'}</Typography>
                            </td>
                            <td>
                              <Typography color='text.primary'>{invoice.landlordName || 'Landlord'}</Typography>
                            </td>
                            <td>
                              <Typography color='text.primary'>{invoice.period || 'Current Period'}</Typography>
                            </td>
                            <td>
                              <Typography color='text.primary'>{formatKES(invoice.dueAmount)}</Typography>
                            </td>
                            <td>
                              <Typography color='text.primary'>{formatKES(invoice.paidAmount)}</Typography>
                            </td>
                            <td>
                              <Typography color='text.primary'>{formatKES(invoice.outstandingAmount)}</Typography>
                            </td>
                            <td>
                              <Chip
                                label={invoice.status || 'pending'}
                                size='small'
                                variant='tonal'
                                color={getChipColor(invoice.status)}
                              />
                            </td>
                            <td>
                              <div className='flex flex-wrap gap-2'>
                                <Button
                                  size='small'
                                  variant='contained'
                                  onClick={() => openPayDialog(invoice)}
                                  disabled={!hasOutstanding}
                                >
                                  Pay
                                </Button>
                                <Button
                                  size='small'
                                  variant='text'
                                  component='a'
                                  href={`/api/tenant/invoices/${encodeURIComponent(invoice.id)}/download`}
                                >
                                  Download Invoice
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
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card className='mp-dashboard-section'>
            <CardContent>
              <div className='flex items-center justify-between gap-4 mbe-4'>
                <Typography variant='h5'>Recent Payment Activity</Typography>
                <Chip
                  label={`${context.recentPayments.length} Payments`}
                  color='primary'
                  variant='tonal'
                  size='small'
                />
              </div>
              <div className='overflow-x-auto'>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Landlord</th>
                      <th>Channel</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {context.recentPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <Typography color='text.secondary'>No payment activity yet.</Typography>
                        </td>
                      </tr>
                    ) : (
                      context.recentPayments.map(payment => (
                        <tr key={payment.id || `${payment.receiptNo}-${payment.createdAt}`}>
                          <td>
                            <Typography color='text.primary'>{payment.receiptNo || 'Pending'}</Typography>
                          </td>
                          <td>
                            <Typography color='text.primary'>{payment.landlordName || 'Landlord'}</Typography>
                          </td>
                          <td>
                            <Typography color='text.primary'>{payment.channel || 'N/A'}</Typography>
                          </td>
                          <td>
                            <Typography color='text.primary'>{formatKES(payment.amount)}</Typography>
                          </td>
                          <td>
                            <Chip
                              label={payment.status || 'pending'}
                              size='small'
                              variant='tonal'
                              color={getChipColor(payment.status)}
                            />
                          </td>
                          <td>
                            <Typography color='text.primary'>
                              {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-KE') : 'N/A'}
                            </Typography>
                          </td>
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

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Pay Invoice</DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-4'>
          {submitError && <Alert severity='error'>{submitError}</Alert>}
          <Alert severity='info' variant='tonal'>
            {`Payment will be routed to ${selectedInvoice?.landlordName || 'your landlord'} for reconciliation.`}
          </Alert>
          <Typography color='text.secondary'>
            {selectedInvoice
              ? `Invoice ${selectedInvoice.invoiceNo} (${selectedInvoice.period}) - Balance ${formatKES(selectedInvoice.outstandingAmount)}`
              : 'Select an invoice to continue.'}
          </Typography>
          <TextField
            label='Payment Method'
            select
            fullWidth
            value={paymentForm.method}
            onChange={event => handleFormChange('method', event.target.value)}
          >
            {PAYMENT_METHODS.map(method => (
              <MenuItem key={method.value} value={method.value}>
                {method.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label='Amount (KES)'
            type='number'
            fullWidth
            value={paymentForm.amount}
            onChange={event => handleFormChange('amount', event.target.value)}
          />
          <TextField
            label={paymentForm.method === 'mpesa' ? 'M-Pesa Phone Number' : 'Phone Number (Optional)'}
            fullWidth
            required={paymentForm.method === 'mpesa'}
            value={paymentForm.phoneNumber}
            placeholder='07XXXXXXXX'
            onChange={event => handleFormChange('phoneNumber', event.target.value)}
          />
          <TextField
            label='Payer Full Name'
            fullWidth
            value={paymentForm.payerName}
            onChange={event => handleFormChange('payerName', event.target.value)}
          />
          <TextField
            label='Reference'
            fullWidth
            value={paymentForm.accountReference}
            onChange={event => handleFormChange('accountReference', event.target.value)}
            placeholder='Invoice number or transaction reference'
          />
          <TextField
            label='Notes'
            fullWidth
            multiline
            minRows={2}
            value={paymentForm.notes}
            onChange={event => handleFormChange('notes', event.target.value)}
          />
          <TextField
            label='Upload Proof / Invoice Slip (Optional)'
            type='file'
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText={
              paymentForm.proofFile ? paymentForm.proofFile.name : 'PDF, image, or document files are supported.'
            }
            inputProps={{ accept: '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx' }}
            onChange={event => handleFormChange('proofFile', event.target.files?.[0] || null)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmitPayment} variant='contained' disabled={isSubmitting}>
            {isSubmitting ? (
              <CircularProgress size={20} color='inherit' />
            ) : paymentForm.method === 'mpesa' ? (
              'Send STK Prompt'
            ) : (
              'Submit Payment'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default TenantPaymentsWorkspace
