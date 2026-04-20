'use client'

import Link from 'next/link'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
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

  return parsed.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatKES = value => {
  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return 'KES 0'
  }

  return `KES ${amount.toLocaleString('en-KE')}`
}

const getFeatureStatusColor = row => {
  if (row?.isLive) {
    return 'success'
  }

  if (row?.isActive) {
    return 'warning'
  }

  return 'default'
}

const SubscriptionOverviewCard = ({ overview, role = 'landlord' }) => {
  const currentPlan = overview?.currentPlan
  const activeFeatures = Array.isArray(overview?.activeFeatures) ? overview.activeFeatures : []
  const paymentHistory = Array.isArray(overview?.paymentHistory) ? overview.paymentHistory : []
  const latestPayment = paymentHistory[0] || null
  const currentPlanCode = toText(overview?.currentPlanCode || overview?.recommendedPlanCode || 'landlord_full_access')

  return (
    <Card className='mp-dashboard-section mp-perf-card'>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' spacing={2}>
            <div>
              <Typography variant='h5'>Subscription Center</Typography>
              <Typography color='text.secondary'>
                Keep track of your active tools, payment history, and renewal path without leaving the dashboard.
              </Typography>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Button
                component={Link}
                href={`/pricing?audience=landlord&role=${role}&recommended=${currentPlanCode}`}
                variant='outlined'
              >
                {overview?.canRenew ? 'Renew or change plan' : 'Choose a plan'}
              </Button>
              <Button component={Link} href='/subscription-center' variant='contained'>
                Open Subscription Center
              </Button>
            </div>
          </Stack>

          {!currentPlan ? (
            <Alert severity='warning' variant='tonal'>
              No active landlord plan found yet. Choose a plan to unlock marketplace or management tools.
            </Alert>
          ) : (
            <Alert severity='success' variant='tonal'>
              Current plan: {currentPlan.planName}. Billing cycle: {toText(currentPlan.billingCycle) || 'yearly'}.
            </Alert>
          )}

          <Stack spacing={1.5}>
            <Typography variant='h6'>Active Access</Typography>
            {!activeFeatures.length ? (
              <Typography color='text.secondary'>No live feature access found yet.</Typography>
            ) : (
              activeFeatures.map(feature => (
                <Stack
                  key={feature.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent='space-between'
                  spacing={1}
                >
                  <Typography>{feature.label}</Typography>
                  <Chip
                    label={feature.expiresAt ? `Active until ${toDisplayDate(feature.expiresAt)}` : 'Active'}
                    color={getFeatureStatusColor(feature)}
                    size='small'
                    variant='tonal'
                    sx={{ alignSelf: 'flex-start' }}
                  />
                </Stack>
              ))
            )}
          </Stack>

          {latestPayment ? (
            <Stack spacing={1}>
              <Typography variant='h6'>Latest Billing</Typography>
              <Typography color='text.secondary'>
                {latestPayment.planName} · {formatKES(latestPayment.amount)} · {toText(latestPayment.status) || 'pending'}
              </Typography>
              <Typography color='text.secondary'>
                Paid/updated: {toDisplayDate(latestPayment.paidAt || latestPayment.createdAt)}
                {latestPayment.receiptNumber ? ` · Receipt ${latestPayment.receiptNumber}` : ''}
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  )
}

export default SubscriptionOverviewCard
