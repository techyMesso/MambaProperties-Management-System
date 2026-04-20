'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import dynamic from 'next/dynamic'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'

import SectionErrorBoundary from '@components/errors/SectionErrorBoundary'
import AnalyticsPanelSkeleton from '@components/skeletons/AnalyticsPanelSkeleton'
import { useRealtimeDashboardMetrics } from '@/hooks/useRealtimeDashboardMetrics'

const AdminHeavyAnalytics = dynamic(() => import('./analytics/AdminHeavyAnalytics'), {
  suspense: true
})

const HEALTH_POLL_INTERVAL_MS = 60 * 1000

const AdminDashboardRealtime = ({ initialMetrics, initialError }) => {
  const { metrics, isRefreshing, refreshNow, refreshError, lastUpdatedAt } = useRealtimeDashboardMetrics({
    scope: 'admin',
    initialMetrics,
    initialError
  })

  const [systemHealth, setSystemHealth] = useState({
    loading: true,
    refreshing: false,
    error: '',
    data: null
  })

  const loadSystemHealth = useCallback(async ({ background = false } = {}) => {
    setSystemHealth(previous => ({
      ...previous,
      loading: background ? previous.loading : true,
      refreshing: background,
      error: background ? previous.error : ''
    }))

    try {
      const response = await fetch('/api/admin/system-health', {
        method: 'GET',
        cache: 'no-store'
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || 'Unable to load system health.')
      }

      setSystemHealth({
        loading: false,
        refreshing: false,
        error: '',
        data: payload
      })
    } catch (error) {
      setSystemHealth(previous => ({
        ...previous,
        loading: false,
        refreshing: false,
        error: error instanceof Error ? error.message : 'Unable to load system health.'
      }))
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async background => {
      if (cancelled) {
        return
      }

      await loadSystemHealth({ background })
    }

    run(false)

    const intervalId = setInterval(() => {
      run(true)
    }, HEALTH_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [loadSystemHealth])

  const alerts = useMemo(() => (Array.isArray(metrics.alerts) ? metrics.alerts : []), [metrics.alerts])
  const actionQueues = useMemo(() => (Array.isArray(metrics.actionQueues) ? metrics.actionQueues : []), [metrics.actionQueues])
  const healthData = systemHealth.data
  const isReadyUp = healthData?.ready?.status === 'up'
  const isLiveUp = healthData?.live?.status === 'up'
  const alertingEnabled = Boolean(healthData?.alerting?.enabled)
  const checkedAtText = healthData?.checkedAt ? new Date(healthData.checkedAt).toLocaleString() : 'Not checked yet'
  const lastUpdatedText = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : 'Waiting for first live sync'

  const metricCards = useMemo(
    () => [
      { label: 'Verified Landlords', value: String(metrics.verifiedLandlords), hint: 'Profiles with landlord role' },
      { label: 'Active Subscriptions', value: String(metrics.activeSubscriptions), hint: 'Currently billable accounts' },
      { label: 'Platform Transactions', value: metrics.platformTransactions, hint: 'Paid and partial this month' },
      { label: 'Audit Events (24h)', value: String(metrics.auditEvents24h), hint: 'Security/compliance activity' }
    ],
    [metrics.activeSubscriptions, metrics.auditEvents24h, metrics.platformTransactions, metrics.verifiedLandlords]
  )

  const listingPreviews = useMemo(
    () => [
      {
        title: 'Runda Royale',
        meta: 'Pending verification · 2 docs',
        value: 'KES 2.5M annual',
        badge: 'Verification',
        gallery: '6+',
        image: 'https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Kilimani Suites',
        meta: 'Compliance check queued',
        value: 'KES 1.9M annual',
        badge: 'Audit review',
        gallery: '8+',
        image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
      },
      {
        title: 'Westlands Heights',
        meta: 'Payments synced · 5 invoices',
        value: 'KES 3.1M annual',
        badge: 'Revenue watch',
        gallery: '10+',
        image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
      }
    ],
    []
  )

  const tasks = useMemo(
    () => [
      `Review ${metrics.auditEvents24h} audit events logged in the last 24 hours.`,
      `Monitor ${metrics.totalPlots} registered plots and ${metrics.occupiedUnits} occupied units across the platform.`,
      'Validate landlord KYC and subscription updates before billing cutoff.'
    ],
    [metrics.auditEvents24h, metrics.occupiedUnits, metrics.totalPlots]
  )

  const healthMeters = useMemo(
    () => [
      {
        key: 'live',
        label: 'Live API',
        tone: isLiveUp ? 'success' : 'error',
        value: isLiveUp ? 100 : 28,
        status: isLiveUp ? 'Healthy' : 'Offline'
      },
      {
        key: 'ready',
        label: 'Readiness',
        tone: isReadyUp ? 'success' : 'warning',
        value: isReadyUp ? 100 : 54,
        status: isReadyUp ? 'Ready' : 'Degraded'
      },
      {
        key: 'alerting',
        label: 'Alerting',
        tone: alertingEnabled ? 'info' : 'warning',
        value: alertingEnabled ? 100 : 42,
        status: alertingEnabled ? 'Enabled' : 'Needs setup'
      }
    ],
    [alertingEnabled, isLiveUp, isReadyUp]
  )

  const severityColor = severity => {
    if (severity === 'error') {
      return 'error'
    }

    if (severity === 'warning') {
      return 'warning'
    }

    if (severity === 'info') {
      return 'info'
    }

    return 'success'
  }

  return (
    <Grid container spacing={6}>
      <Grid item xs={12} className='mp-fade-up'>
        <Card className='mp-dashboard-hero mp-perf-card'>
          <CardContent className='mp-dashboard-hero-grid'>
            <div className='flex flex-col gap-4'>
              <div>
                <div className='mp-dashboard-hero-kicker'>Platform control center</div>
                <Typography variant='h4' className='mp-dashboard-hero-title flex items-center gap-3'>
                  <span>Admin Dashboard</span>
                  <span className={`mp-live-dot${isRefreshing ? ' mp-live-dot--syncing' : ''}`} aria-hidden='true' />
                </Typography>
                <Typography className='text-textSecondary mp-dashboard-hero-lead'>
                  Manage platform verification, billing controls, security logs, and compliance actions. Last synced {lastUpdatedText}.
                </Typography>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Chip label={isRefreshing ? 'Syncing...' : 'Live Sync'} color={isRefreshing ? 'info' : 'success'} variant='tonal' size='small' />
                <span className='mp-status-pill mp-status-pill--info'>Updated {lastUpdatedText}</span>
                <span className={`mp-status-pill mp-status-pill--${isReadyUp ? 'success' : 'warning'}`}>
                  {isReadyUp ? 'Platform ready' : 'Platform degraded'}
                </span>
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
                <Button component={Link} href='/admin' variant='contained' startIcon={<i className='ri-shield-check-line' />}>
                  Open Admin Console
                </Button>
                <Button component={Link} href='/reports' variant='outlined' startIcon={<i className='ri-bar-chart-box-line' />}>
                  View Reports
                </Button>
              </div>
            </div>
            <div className='mp-dashboard-hero-stat'>
              <div className='mp-dashboard-hero-stat-label'>Active oversight</div>
              <div className='mp-dashboard-hero-stat-value'>{metrics.auditEvents24h}</div>
              <div className='mp-dashboard-hero-stat-meta'>audit events in the last 24 hours</div>
              <div className='mt-4 flex flex-col gap-2'>
                <div className='mp-status-pill mp-status-pill--success'>{metrics.verifiedLandlords} verified landlords</div>
                <div className='mp-status-pill mp-status-pill--info'>{metrics.activeSubscriptions} active subscriptions</div>
                <div className={`mp-status-pill mp-status-pill--${alertingEnabled ? 'success' : 'warning'}`}>
                  {alertingEnabled ? 'Alerting connected' : 'Alerting needs setup'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {alerts.length > 0 && (
        <Grid item xs={12} className='mp-fade-up mp-fade-up--d1'>
          <Card className='mp-dashboard-section mp-perf-card'>
            <CardContent className='flex flex-col gap-3'>
              <Typography variant='h6'>Attention Needed</Typography>
              {alerts.map(alert => (
                <Alert
                  key={alert.key}
                  severity={alert.severity || 'info'}
                  variant='tonal'
                  action={
                    alert.href ? (
                      <Button component={Link} href={alert.href} size='small' color='inherit'>
                        Open
                      </Button>
                    ) : null
                  }
                >
                  {alert.message}
                </Alert>
              ))}
            </CardContent>
          </Card>
        </Grid>
      )}

      {metricCards.map((item, index) => (
        <Grid item xs={12} sm={6} md={3} key={item.label} className={`mp-fade-up mp-fade-up--d${Math.min(index + 1, 5)}`}>
          <Card className='mp-dashboard-kpi mp-perf-card'>
            <CardContent>
              <Typography className='text-textSecondary'>{item.label}</Typography>
              <Typography variant='h4'>{item.value}</Typography>
              <Typography variant='body2'>{item.hint}</Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid item xs={12} className='mp-fade-up mp-fade-up--d5'>
        <Card className='mp-dashboard-section mp-perf-card'>
          <CardContent>
            <Typography variant='h5'>Verification Queue Preview</Typography>
            <Typography color='text.secondary'>
              Real-time look at high-value listings awaiting approval or compliance review.
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
          <CardContent className='flex flex-col gap-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <Typography variant='h6'>System Health</Typography>
              <div className='flex flex-wrap gap-2'>
                <span className={`mp-status-pill mp-status-pill--${isLiveUp ? 'success' : 'error'}`}>{isLiveUp ? 'Live API up' : 'Live API down'}</span>
                <span className={`mp-status-pill mp-status-pill--${isReadyUp ? 'success' : 'warning'}`}>
                  {isReadyUp ? 'Ready for traffic' : 'Readiness degraded'}
                </span>
                <span className={`mp-status-pill mp-status-pill--${alertingEnabled ? 'info' : 'warning'}`}>
                  {alertingEnabled ? 'Alerting enabled' : 'Alerting disabled'}
                </span>
                {systemHealth.refreshing ? <span className='mp-status-pill mp-status-pill--info'>Refreshing</span> : null}
              </div>
            </div>
            <Typography variant='body2' color='text.secondary'>
              Last checked: {checkedAtText}
            </Typography>
            <div className='mp-status-grid'>
              {healthMeters.map(item => (
                <div key={item.key} className='mp-status-meter'>
                  <div className='mp-status-meter-head'>
                    <Typography variant='body2' color='text.primary'>
                      {item.label}
                    </Typography>
                    <span className={`mp-status-pill mp-status-pill--${item.tone}`}>{item.status}</span>
                  </div>
                  <div className='mp-status-track' aria-hidden='true'>
                    <div className={`mp-status-fill mp-status-fill--${item.tone}`} style={{ inlineSize: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {systemHealth.loading && (
              <Typography variant='body2' color='text.secondary'>
                Loading health status...
              </Typography>
            )}
            {systemHealth.error && (
              <Alert severity='warning' variant='tonal'>
                {systemHealth.error}
              </Alert>
            )}
            {!isReadyUp && !systemHealth.loading && (
              <Alert severity='error' variant='tonal'>
                System readiness is degraded. Review dependency status and monitoring alerts.
              </Alert>
            )}
            {!alertingEnabled && !systemHealth.loading && (
              <Alert severity='info' variant='tonal'>
                Ops webhook alerting is not configured. Set <code>ALERT_WEBHOOK_URL</code> and <code>MONITORING_CRON_KEY</code>.
              </Alert>
            )}
            <div className='flex flex-wrap gap-2'>
              <Button variant='text' startIcon={<i className='ri-heart-pulse-line' />} onClick={() => loadSystemHealth({ background: true })}>
                {systemHealth.refreshing ? 'Refreshing...' : 'Refresh Health'}
              </Button>
              <Button component={Link} href='/system-settings' variant='outlined' startIcon={<i className='ri-settings-3-line' />}>
                System Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {actionQueues.map((queue, index) => (
        <Grid item xs={12} sm={6} md={3} key={queue.key} className={`mp-fade-up mp-fade-up--d${Math.min(index + 1, 5)}`}>
          <Card className='mp-dashboard-section mp-perf-card'>
            <CardContent className='flex flex-col gap-3'>
              <div className='flex items-center justify-between gap-3'>
                <Typography variant='body1'>{queue.label}</Typography>
                <Chip
                  label={String(queue.count)}
                  color={severityColor(queue.severity)}
                  size='small'
                  variant='tonal'
                />
              </div>
              <Typography variant='body2' color='text.secondary'>
                {queue.hint}
              </Typography>
              {queue.href ? (
                <Button component={Link} href={queue.href} variant='text' className='self-start'>
                  Open Queue
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </Grid>
      ))}

      <Grid item xs={12} className='mp-fade-up mp-fade-up--d5'>
        <Card className='mp-dashboard-section mp-perf-card'>
          <CardContent>
            <Typography variant='h5'>Priority Actions</Typography>
            <div className='flex flex-col gap-3 mt-4'>
              {tasks.map(task => (
                <div key={task} className='flex items-start gap-2'>
                  <i className='ri-checkbox-circle-line text-success text-[20px]' />
                  <Typography color='text.primary'>{task}</Typography>
                </div>
              ))}
            </div>
            <div className='flex flex-wrap gap-3 mt-5'>
              <Button component={Link} href='/admin' variant='text'>
                Open Compliance Queue
              </Button>
              <Button component={Link} href='/reports' variant='text'>
                Review Platform Reports
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} className='mp-fade-up mp-fade-up--d5'>
        <SectionErrorBoundary>
          <Suspense fallback={<AnalyticsPanelSkeleton />}>
            <AdminHeavyAnalytics
              analytics={metrics.analytics}
              refreshNow={refreshNow}
              isRefreshing={isRefreshing}
              lastUpdatedAt={lastUpdatedAt}
            />
          </Suspense>
        </SectionErrorBoundary>
      </Grid>
    </Grid>
  )
}

export default AdminDashboardRealtime
