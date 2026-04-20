'use client'

import { useMemo } from 'react'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import { useRealtimeDashboardMetrics } from '@/hooks/useRealtimeDashboardMetrics'

const TenantDashboardRealtime = ({ initialMetrics, initialError }) => {
  const searchParams = useSearchParams()

  const { metrics, isRefreshing, refreshNow, refreshError } = useRealtimeDashboardMetrics({
    scope: 'tenant',
    initialMetrics,
    initialError
  })

  const isVerified = searchParams?.get('verified') === '1'

  const cards = useMemo(
    () => [
      { label: 'Current Rent Balance', value: metrics.rentBalance, hint: 'Outstanding invoice amount' },
      { label: 'Paid Amount', value: metrics.paidThisMonth, hint: 'Tracked from rent payments' },
      { label: 'Payment Status', value: metrics.paymentStatus, hint: 'Based on invoices vs payments' },
      { label: 'Open Requests', value: String(metrics.openRequests), hint: 'Maintenance tickets in progress' }
    ],
    [metrics.openRequests, metrics.paidThisMonth, metrics.paymentStatus, metrics.rentBalance]
  )

  const savedHomes = useMemo(
    () => [
      {
        title: 'Runda Court',
        meta: '2BR · Westlands',
        value: 'KES 85K avg',
        badge: 'Saved',
        gallery: '16+',
        image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Kilimani Suites',
        meta: '1BR · Kilimani',
        value: 'KES 61K avg',
        badge: 'Viewing open',
        gallery: '9+',
        image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Westlands Residences',
        meta: '2BR · Westlands',
        value: 'KES 90K avg',
        badge: 'New match',
        gallery: '12+',
        image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80'
      }
    ],
    []
  )

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Card className='mp-dashboard-hero mp-perf-card'>
          <CardContent className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <Typography variant='h4'>Tenant Dashboard</Typography>
                <Chip label={isRefreshing ? 'Syncing...' : 'Live Sync'} color={isRefreshing ? 'info' : 'success'} variant='tonal' size='small' />
              </div>
              <Typography className='text-textSecondary'>
                View balances, pay rent, download receipts, report issues, and request tenancy changes.
              </Typography>
              {isVerified && (
                <Alert className='mt-3' severity='success' variant='tonal'>
                  Email verified successfully. You can explore the dashboard and subscribe when you open the marketplace.
                </Alert>
              )}
              {refreshError && (
                <Alert className='mt-3' severity='warning' variant='tonal'>
                  {refreshError}
                </Alert>
              )}
            </div>
            <div className='flex flex-wrap gap-3'>
              <Button variant='text' startIcon={<i className='ri-refresh-line' />} onClick={refreshNow}>
                Refresh
              </Button>
              <Button component={Link} href='/payments?intent=pay-rent' variant='contained' startIcon={<i className='ri-bank-card-line' />}>
                Pay Rent
              </Button>
              <Button component={Link} href='/marketplace?intent=search' variant='outlined' startIcon={<i className='ri-home-search-line' />}>
                Search Houses
              </Button>
              <Button component={Link} href='/marketplace?saved=1' variant='outlined' startIcon={<i className='ri-home-heart-line' />}>
                Saved Houses
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {cards.map(item => (
        <Grid item xs={12} sm={6} md={3} key={item.label}>
          <Card className='mp-dashboard-kpi mp-perf-card'>
            <CardContent>
              <Typography className='text-textSecondary'>{item.label}</Typography>
              <Typography variant='h4'>{item.value}</Typography>
              <Typography variant='body2'>{item.hint}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid item xs={12}>
        <Card className='mp-dashboard-section mp-perf-card'>
          <CardContent>
            <Typography variant='h5'>Saved Homes Preview</Typography>
            <Typography color='text.secondary'>A quick look at listings you can act on right now.</Typography>
            <div className='mp-dashboard-listing-grid mt-4'>
              {savedHomes.map(item => (
                <div className='mp-dashboard-listing-card' key={item.title}>
                  <div
                    className='mp-dashboard-listing-image'
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.24)), url('${item.image}')`
                    }}
                  >
                    <span className='mp-dashboard-listing-badge'>{item.badge}</span>
                    <span className='mp-dashboard-listing-gallery'>
                      <i className='ri-image-line' aria-hidden='true' />
                      {item.gallery}
                    </span>
                  </div>
                  <div className='mp-dashboard-listing-body'>
                    <div className='mp-dashboard-listing-title'>{item.title}</div>
                    <div className='mp-dashboard-listing-meta'>{item.meta}</div>
                    <div className='mp-dashboard-listing-value'>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card className='mp-dashboard-section mp-perf-card'>
          <CardContent className='flex flex-col gap-4'>
            <Typography variant='h5'>Quick Actions</Typography>
            <Typography color='text.secondary'>
              {`${metrics.relocationUnits} vacant units are available for relocation workflows.`}
            </Typography>
            <div className='flex flex-wrap gap-3'>
              <Button component={Link} href='/invoices' variant='text'>
                View Invoices
              </Button>
              <Button component={Link} href='/invoices?view=receipts' variant='text'>
                View Receipts
              </Button>
              <Button component={Link} href='/maintenance' variant='text'>
                Report Maintenance
              </Button>
              <Button component={Link} href='/documents' variant='text'>
                My Documents
              </Button>
              <Button component={Link} href='/messaging' variant='text'>
                My Inquiries
              </Button>
              <Button component={Link} href='/marketplace?saved=1' variant='text'>
                View Saved Houses
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default TenantDashboardRealtime
