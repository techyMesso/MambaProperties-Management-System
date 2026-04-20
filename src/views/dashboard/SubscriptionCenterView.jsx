'use client'

import Link from 'next/link'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

const toText = value => String(value || '').trim()

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

const formatKES = value => {
  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return 'KES 0'
  }

  return `KES ${amount.toLocaleString('en-KE')}`
}

const SubscriptionCenterView = ({ overview, role = 'landlord' }) => {
  const currentPlanCode = toText(overview?.currentPlanCode || overview?.recommendedPlanCode || 'landlord_full_access')
  const activeFeatures = Array.isArray(overview?.activeFeatures) ? overview.activeFeatures : []
  const pendingFeatures = Array.isArray(overview?.pendingFeatures) ? overview.pendingFeatures : []
  const expiredFeatures = Array.isArray(overview?.expiredFeatures) ? overview.expiredFeatures : []
  const paymentHistory = Array.isArray(overview?.paymentHistory) ? overview.paymentHistory : []

  return (
    <Container maxWidth='lg' sx={{ py: { xs: 6, md: 8 } }}>
      <Stack spacing={4}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' spacing={2}>
          <div>
            <Typography variant='h3'>Subscription Center</Typography>
            <Typography color='text.secondary'>
              Review your current access, billing history, and the next best subscription move for your rentals.
            </Typography>
          </div>
          <div className='flex flex-wrap gap-3'>
            <Button component={Link} href={`/pricing?audience=landlord&role=${role}&recommended=${currentPlanCode}`} variant='contained'>
              {overview?.canRenew ? 'Renew or upgrade' : 'Choose a plan'}
            </Button>
            <Button component={Link} href={role === 'agent' ? '/agent-dashboard' : '/landlord-dashboard'} variant='outlined'>
              Back to dashboard
            </Button>
          </div>
        </Stack>

        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant='h6'>Current Plan</Typography>
                  <Typography variant='h4'>{overview?.currentPlan?.planName || 'No active plan'}</Typography>
                  <Typography color='text.secondary'>
                    {overview?.currentPlan?.description || 'Choose a marketplace, management, or full access plan to unlock tools.'}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant='h6'>Approval</Typography>
                  <Typography variant='h4'>{toText(overview?.profile?.approval_status || 'pending') || 'pending'}</Typography>
                  <Typography color='text.secondary'>
                    KYC: {overview?.profile?.kyc_verified === true ? 'verified' : 'pending'}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant='h6'>Recent Billing</Typography>
                  <Typography variant='h4'>{paymentHistory.length}</Typography>
                  <Typography color='text.secondary'>
                    Landlord subscription payment records linked to this account.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {!overview?.currentPlan ? (
          <Alert severity='warning' variant='tonal'>
            There is no active plan on this account yet. Use the pricing page to subscribe, then come back here to track renewals and billing.
          </Alert>
        ) : null}

        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant='h5'>Live Access</Typography>
                  {!activeFeatures.length ? (
                    <Typography color='text.secondary'>No active feature access found.</Typography>
                  ) : (
                    activeFeatures.map(feature => (
                      <Stack key={feature.id} direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' spacing={1}>
                        <Typography>{feature.label}</Typography>
                        <Chip
                          label={feature.expiresAt ? `Expires ${toDisplayDate(feature.expiresAt)}` : 'Active'}
                          color='success'
                          size='small'
                          variant='tonal'
                          sx={{ alignSelf: 'flex-start' }}
                        />
                      </Stack>
                    ))
                  )}

                  {pendingFeatures.length ? (
                    <>
                      <Typography variant='h6'>Pending Access</Typography>
                      {pendingFeatures.map(feature => (
                        <Stack key={feature.id} direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' spacing={1}>
                          <Typography>{feature.label}</Typography>
                          <Chip label='Awaiting payment/activation' color='warning' size='small' variant='tonal' sx={{ alignSelf: 'flex-start' }} />
                        </Stack>
                      ))}
                    </>
                  ) : null}

                  {expiredFeatures.length ? (
                    <>
                      <Typography variant='h6'>Expired Access</Typography>
                      {expiredFeatures.map(feature => (
                        <Stack key={feature.id} direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' spacing={1}>
                          <Typography>{feature.label}</Typography>
                          <Chip label='Expired' color='default' size='small' variant='tonal' sx={{ alignSelf: 'flex-start' }} />
                        </Stack>
                      ))}
                    </>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant='h5'>Billing History</Typography>
                  {!paymentHistory.length ? (
                    <Typography color='text.secondary'>No subscription billing records found yet.</Typography>
                  ) : (
                    paymentHistory.map(payment => (
                      <Stack key={payment.id} spacing={0.5}>
                        <Typography>{payment.planName}</Typography>
                        <Typography color='text.secondary'>
                          {formatKES(payment.amount)} · {toText(payment.status) || 'pending'}
                        </Typography>
                        <Typography color='text.secondary'>
                          {toDisplayDate(payment.paidAt || payment.createdAt)}
                          {payment.receiptNumber ? ` · Receipt ${payment.receiptNumber}` : ''}
                        </Typography>
                      </Stack>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Container>
  )
}

export default SubscriptionCenterView
