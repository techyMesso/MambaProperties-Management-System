'use client'

import { useMemo } from 'react'

import Link from 'next/link'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import { useRealtimeDashboardMetrics } from '@/hooks/useRealtimeDashboardMetrics'
import SubscriptionOverviewCard from './SubscriptionOverviewCard'

const AgentDashboardRealtime = ({ initialMetrics, initialError, subscriptionOverview }) => {
  const { metrics, isRefreshing, refreshNow, refreshError } = useRealtimeDashboardMetrics({
    scope: 'agent',
    initialMetrics,
    initialError
  })

  const cards = useMemo(
    () => [
      { label: 'Active Listings', value: String(metrics.activeListings), hint: 'Vacant units ready for marketing' },
      { label: 'Viewings This Week', value: String(metrics.viewingsThisWeek), hint: 'Scheduled unit visits' },
      { label: 'Pending Tenancies', value: String(metrics.pendingTenancies), hint: 'Onboarding in progress' },
      { label: 'Open Tickets', value: String(metrics.openTickets), hint: 'Maintenance follow-up required' }
    ],
    [metrics.activeListings, metrics.openTickets, metrics.pendingTenancies, metrics.viewingsThisWeek]
  )

  const listingPipeline = useMemo(
    () => [
      {
        title: 'Kilimani Suites',
        meta: '3 viewings today',
        value: 'KES 61K avg',
        badge: 'Hot listing',
        gallery: '9+',
        image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Runda Court',
        meta: '2 enquiries pending',
        value: 'KES 120K avg',
        badge: 'New leads',
        gallery: '16+',
        image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Westlands Residences',
        meta: 'Next visit: Tue 10:00',
        value: 'KES 85K avg',
        badge: 'Scheduled',
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
                <Typography variant='h4'>Agent Dashboard</Typography>
                <Chip label={isRefreshing ? 'Syncing...' : 'Live Sync'} color={isRefreshing ? 'info' : 'success'} variant='tonal' size='small' />
              </div>
              <Typography className='text-textSecondary'>
                Coordinate listings, tenant onboarding, appointments, and day-to-day property operations.
              </Typography>
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
              <Button component={Link} href='/marketplace?intent=manage-listings' variant='contained' startIcon={<i className='ri-store-2-line' />}>
                Manage Listings
              </Button>
              <Button component={Link} href='/tenancies' variant='outlined' startIcon={<i className='ri-file-list-3-line' />}>
                Track Tenancies
              </Button>
              <Button component={Link} href='/subscription-center' variant='outlined' startIcon={<i className='ri-vip-crown-line' />}>
                Subscription Center
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
            <Typography variant='h5'>Listing Pipeline</Typography>
            <Typography color='text.secondary'>Active listings and next actions for your tenant pipeline.</Typography>
            <div className='mp-dashboard-listing-grid mt-4'>
              {listingPipeline.map(item => (
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
            <Typography variant='h5'>Today Focus</Typography>
            <Typography color='text.secondary'>
              {`You have ${metrics.unreadOrPendingMessages} pending communication threads and ${metrics.openTickets} open maintenance tickets to coordinate.`}
            </Typography>
            <div className='flex flex-wrap gap-3'>
              <Button component={Link} href='/tenants' variant='text'>
                Tenant Profiles
              </Button>
              <Button component={Link} href='/maintenance' variant='text'>
                Maintenance Status
              </Button>
              <Button component={Link} href='/messaging' variant='text'>
                Tenant Inquiries
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <SubscriptionOverviewCard overview={subscriptionOverview} role='agent' />
      </Grid>
    </Grid>
  )
}

export default AgentDashboardRealtime
