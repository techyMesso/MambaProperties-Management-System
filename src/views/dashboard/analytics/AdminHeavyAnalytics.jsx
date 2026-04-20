'use client'

import { useMemo, useState } from 'react'

import dynamic from 'next/dynamic'

import Grid from '@mui/material/Grid'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

const LineChart = dynamic(() => import('../LineChart'))
const DistributedColumnChart = dynamic(() => import('../DistributedColumnChart'))

const AdminHeavyAnalytics = ({ analytics, refreshNow, isRefreshing, lastUpdatedAt }) => {
  const [range, setRange] = useState('7d')

  const selectedLine = useMemo(() => {
    const ranges = analytics?.line?.ranges

    if (ranges?.[range]) {
      return ranges[range]
    }

    return analytics?.line || {}
  }, [analytics?.line, range])

  const selectedSessions = useMemo(() => {
    const ranges = analytics?.sessions?.ranges

    if (ranges?.[range]) {
      return ranges[range]
    }

    return analytics?.sessions || {}
  }, [analytics?.sessions, range])

  const handleRangeChange = (_, nextRange) => {
    if (!nextRange) {
      return
    }

    setRange(nextRange)
  }

  const syncedAt =
    typeof lastUpdatedAt === 'number' && Number.isFinite(lastUpdatedAt)
      ? new Date(lastUpdatedAt).toLocaleTimeString('en-KE', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : null

  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Typography variant='h6'>Analytics Overview</Typography>
          <div className='flex items-center gap-3'>
            {syncedAt ? (
              <Typography variant='body2' color='text.secondary'>
                Synced {syncedAt}
              </Typography>
            ) : null}
            <ToggleButtonGroup size='small' exclusive value={range} onChange={handleRangeChange} aria-label='analytics range'>
              <ToggleButton value='24h' aria-label='24 hours'>
                24h
              </ToggleButton>
              <ToggleButton value='7d' aria-label='7 days'>
                7d
              </ToggleButton>
              <ToggleButton value='30d' aria-label='30 days'>
                30d
              </ToggleButton>
            </ToggleButtonGroup>
          </div>
        </div>
      </Grid>
      <Grid item xs={12} md={6}>
        <LineChart
          seriesData={selectedLine?.series}
          totalLabel={selectedLine?.totalLabel}
          caption={selectedLine?.caption}
          refreshNow={refreshNow}
          isRefreshing={isRefreshing}
          lastUpdatedAt={lastUpdatedAt}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <DistributedColumnChart
          seriesData={selectedSessions?.series}
          totalLabel={selectedSessions?.totalLabel}
          caption={selectedSessions?.caption}
          refreshNow={refreshNow}
          isRefreshing={isRefreshing}
          lastUpdatedAt={lastUpdatedAt}
        />
      </Grid>
    </Grid>
  )
}

export default AdminHeavyAnalytics
