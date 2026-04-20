'use client'

import dynamic from 'next/dynamic'

import Grid from '@mui/material/Grid'

const WeeklyOverview = dynamic(() => import('../WeeklyOverview'))
const TotalEarning = dynamic(() => import('../TotalEarning'))

const LandlordHeavyAnalytics = ({ analytics, refreshNow, isRefreshing, lastUpdatedAt }) => {
  return (
    <Grid container spacing={6}>
      <Grid item xs={12} md={6}>
        <WeeklyOverview
          weeklyOverview={analytics?.weeklyOverview}
          refreshNow={refreshNow}
          isRefreshing={isRefreshing}
          lastUpdatedAt={lastUpdatedAt}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TotalEarning
          totalEarning={analytics?.totalEarning}
          refreshNow={refreshNow}
          isRefreshing={isRefreshing}
          lastUpdatedAt={lastUpdatedAt}
        />
      </Grid>
    </Grid>
  )
}

export default LandlordHeavyAnalytics
