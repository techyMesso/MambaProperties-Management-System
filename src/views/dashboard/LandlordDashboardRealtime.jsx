'use client'

import { Suspense, useMemo } from 'react'

import Link from 'next/link'
import dynamic from 'next/dynamic'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import CardStatVertical from '@components/card-statistics/Vertical'
import SectionErrorBoundary from '@components/errors/SectionErrorBoundary'
import AnalyticsPanelSkeleton from '@components/skeletons/AnalyticsPanelSkeleton'
import { useRealtimeDashboardMetrics } from '@/hooks/useRealtimeDashboardMetrics'
import SubscriptionOverviewCard from './SubscriptionOverviewCard'
import LandlordIncomingProofs from './LandlordIncomingProofs'

const LandlordHeavyAnalytics = dynamic(() => import('./analytics/LandlordHeavyAnalytics'), {
  suspense: true
})

const LandlordDashboardRealtime = ({ initialMetrics, initialError, subscriptionOverview }) => {
  const { metrics, isRefreshing, refreshNow, refreshError, lastUpdatedAt } = useRealtimeDashboardMetrics({
    scope: 'landlord',
    initialMetrics,
    initialError
  })

  const lastUpdatedText = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : 'Waiting for first live sync'

  const kpiCards = useMemo(
    () => [
      {
        title: 'Total Units',
        stats: String(metrics.totalUnits),
        avatarIcon: 'ri-building-2-line',
        avatarColor: 'primary',
        subtitle: `${metrics.totalPlots} plots under management`
      },
      {
        title: 'Occupancy Rate',
        stats: metrics.occupancyRate,
        avatarIcon: 'ri-home-5-line',
        avatarColor: 'success',
        subtitle: 'Occupied versus vacant units across your portfolio',
        progressValue: Number.parseFloat(String(metrics.occupancyRate || '0')) || 0,
        progressLabel: `${metrics.occupiedUnits} occupied / ${metrics.vacantUnits} vacant`
      },
      {
        title: 'Rent Collected',
        stats: metrics.rentCollected,
        avatarIcon: 'ri-money-dollar-circle-line',
        avatarColor: 'info',
        subtitle: 'Paid and partial this month'
      },
      {
        title: 'Arrears Accounts',
        stats: String(metrics.arrearsTenants),
        avatarIcon: 'ri-error-warning-line',
        avatarColor: 'warning',
        subtitle: `${metrics.pendingInvoices} invoices still due`,
        badgeLabel: `${metrics.arrearsTenants} flagged`,
        badgeColor: 'warning'
      }
    ],
    [
      metrics.arrearsTenants,
      metrics.occupancyRate,
      metrics.occupiedUnits,
      metrics.pendingInvoices,
      metrics.rentCollected,
      metrics.totalPlots,
      metrics.totalUnits,
      metrics.vacantUnits
    ]
  )

  const actions = useMemo(
    () => [
      `${metrics.pendingInvoices} invoices are pending collection follow-up.`,
      `${metrics.openMaintenance} maintenance tickets remain open across your units.`,
      `${metrics.vacantUnits} units are currently vacant and can be listed for booking.`
    ],
    [metrics.openMaintenance, metrics.pendingInvoices, metrics.vacantUnits]
  )

  const analytics = useMemo(
    () => metrics.analytics || null,
    [metrics.analytics]
  )

  const listingPreviews = useMemo(
    () => [
      {
        title: 'Kilimani Suites',
        meta: '8 units · 2 open tickets',
        value: 'KES 61K avg',
        badge: 'Top earner',
        gallery: '9+',
        image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Runda Court',
        meta: '15 units · 1 arrears',
        value: 'KES 120K avg',
        badge: 'Low arrears',
        gallery: '12+',
        image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Westlands Residences',
        meta: '12 units · 96% occupied',
        value: 'KES 85K avg',
        badge: 'Occupancy up',
        gallery: '10+',
        image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80'
      }
    ],
    []
  )

  return (
    <Grid container spacing={6}>
      <Grid item xs={12} className='mp-fade-up'>
        <Card className='mp-dashboard-hero mp-perf-card'>
          <CardContent className='mp-dashboard-hero-grid'>
            <div className='flex flex-col gap-4'>
              <div>
                <div className='mp-dashboard-hero-kicker'>Rental operations overview</div>
                <Typography variant='h4' className='mp-dashboard-hero-title flex items-center gap-3'>
                  <span>Landlord Operations Dashboard</span>
                  <span className={`mp-live-dot${isRefreshing ? ' mp-live-dot--syncing' : ''}`} aria-hidden='true' />
                </Typography>
                <Typography className='text-textSecondary mp-dashboard-hero-lead'>
                  Live snapshot of occupancy, collections, arrears, and maintenance from your Supabase records. Last synced {lastUpdatedText}.
                </Typography>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Chip label={isRefreshing ? 'Syncing...' : 'Live Sync'} color={isRefreshing ? 'info' : 'success'} variant='tonal' size='small' />
                <span className='mp-status-pill mp-status-pill--success'>{metrics.occupancyRate} occupancy</span>
                <span className='mp-status-pill mp-status-pill--warning'>{metrics.arrearsTenants} arrears accounts</span>
              </div>
              {refreshError && (
                <Alert className='mt-3' severity='warning' variant='tonal'>
                  {refreshError}
                </Alert>
              )}
              <div className='flex flex-wrap gap-3'>
                <Button variant='text' startIcon={<i className='ri-refresh-line' />} onClick={refreshNow}>
                  Refresh
                </Button>
                <Button component={Link} href='/properties' variant='outlined' startIcon={<i className='ri-community-line' />}>
                  Manage Properties
                </Button>
                <Button component={Link} href='/marketplace?intent=manage-listings' variant='outlined' startIcon={<i className='ri-store-2-line' />}>
                  House Listings
                </Button>
                <Button component={Link} href='/payments' variant='contained' startIcon={<i className='ri-bank-card-line' />}>
                  Track Payments
                </Button>
                <Button component={Link} href='/subscription-center' variant='outlined' startIcon={<i className='ri-vip-crown-line' />}>
                  Subscription Center
                </Button>
              </div>
            </div>
            <div className='mp-dashboard-hero-stat'>
              <div className='mp-dashboard-hero-stat-label'>Collection snapshot</div>
              <div className='mp-dashboard-hero-stat-value'>{metrics.rentCollected}</div>
              <div className='mp-dashboard-hero-stat-meta'>paid and partial collections this month</div>
              <div className='mt-4 flex flex-col gap-2'>
                <div className='mp-status-pill mp-status-pill--success'>{metrics.occupiedUnits} occupied units</div>
                <div className='mp-status-pill mp-status-pill--warning'>{metrics.vacantUnits} vacant units</div>
                <div className='mp-status-pill mp-status-pill--info'>{metrics.pendingInvoices} invoices pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {kpiCards.map((card, index) => (
        <Grid item xs={12} sm={6} lg={3} key={card.title} className={`mp-fade-up mp-fade-up--d${Math.min(index + 1, 4)}`}>
          <CardStatVertical {...card} cardClassName='mp-dashboard-kpi mp-perf-card' />
        </Grid>
      ))}

      <Grid item xs={12} className='mp-fade-up mp-fade-up--d4'>
        <Card className='mp-dashboard-section mp-perf-card'>
          <CardContent>
            <Typography variant='h5'>Listing Snapshot</Typography>
            <Typography color='text.secondary'>
              Photo-backed overview of active properties and performance context.
            </Typography>
            <div className='mp-dashboard-listing-grid mt-4'>
              {listingPreviews.map(item => (
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

      <Grid item xs={12} className='mp-fade-up mp-fade-up--d4'>
        <Card className='mp-dashboard-section mp-perf-card'>
          <CardContent>
            <Typography variant='h5'>Operational Priorities</Typography>
            <div className='flex flex-col gap-3 mt-4'>
              {actions.map(item => (
                <div key={item} className='flex items-start gap-2'>
                  <i className='ri-checkbox-circle-line text-info text-[20px]' />
                  <Typography color='text.primary'>{item}</Typography>
                </div>
              ))}
            </div>
            <div className='flex flex-wrap gap-3 mt-5'>
              <Button component={Link} href='/invoices' variant='text'>
                Review Invoices
              </Button>
              <Button component={Link} href='/maintenance' variant='text'>
                Open Maintenance Queue
              </Button>
              <Button component={Link} href='/messaging' variant='text'>
                Tenant Inquiries
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} className='mp-fade-up mp-fade-up--d5'>
        <LandlordIncomingProofs />
      </Grid>

      <Grid item xs={12} className='mp-fade-up mp-fade-up--d5'>
        <SubscriptionOverviewCard overview={subscriptionOverview} role='landlord' />
      </Grid>

      <Grid item xs={12} className='mp-fade-up mp-fade-up--d5'>
        <SectionErrorBoundary>
          <Suspense fallback={<AnalyticsPanelSkeleton />}>
            <LandlordHeavyAnalytics analytics={analytics} refreshNow={refreshNow} isRefreshing={isRefreshing} lastUpdatedAt={lastUpdatedAt} />
          </Suspense>
        </SectionErrorBoundary>
      </Grid>
    </Grid>
  )
}

export default LandlordDashboardRealtime
