'use client'

import { useMemo } from 'react'

// Next Imports
import dynamic from 'next/dynamic'

// MUI Imports
import Card from '@mui/material/Card'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import CardContent from '@mui/material/CardContent'

// Components Imports
import OptionsMenu from '@core/components/option-menu'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

const DEFAULT_WEEKLY_OVERVIEW = {
  categories: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  series: [0, 0, 0, 0, 0, 0, 0],
  total: 0,
  previousWeekTotal: 0,
  performancePercentage: 0
}

const formatKESCompact = value => {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount <= 0) {
    return 'KES 0'
  }

  if (amount >= 1_000_000) {
    return `KES ${(amount / 1_000_000).toFixed(1)}M`
  }

  if (amount >= 1_000) {
    return `KES ${(amount / 1_000).toFixed(1)}K`
  }

  return `KES ${Math.round(amount)}`
}

const formatSyncLabel = (isRefreshing, lastUpdatedAt) => {
  if (isRefreshing) {
    return 'Syncing live...'
  }

  if (!lastUpdatedAt) {
    return 'Waiting for first sync'
  }

  const date = new Date(lastUpdatedAt)

  if (Number.isNaN(date.getTime())) {
    return 'Waiting for first sync'
  }

  const formatted = new Intl.DateTimeFormat('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)

  return `Last synced ${formatted}`
}

const WeeklyOverview = ({ weeklyOverview, refreshNow, isRefreshing = false, lastUpdatedAt = null }) => {
  // Hooks
  const theme = useTheme()
  const weekly = weeklyOverview || DEFAULT_WEEKLY_OVERVIEW

  // Vars
  const divider = 'var(--mui-palette-divider)'
  const disabled = 'var(--mui-palette-text-disabled)'

  const options = useMemo(
    () => ({
      chart: {
        parentHeightOffset: 0,
        toolbar: { show: false }
      },
      plotOptions: {
        bar: {
          borderRadius: 7,
          distributed: true,
          columnWidth: '40%'
        }
      },
      stroke: {
        width: 2,
        colors: ['var(--mui-palette-background-paper)']
      },
      legend: { show: false },
      grid: {
        xaxis: { lines: { show: false } },
        strokeDashArray: 7,
        padding: { left: -9, top: -20, bottom: 13 },
        borderColor: divider
      },
      dataLabels: { enabled: false },
      colors: weekly.series.map((_, index) =>
        index === new Date().getDay() ? 'var(--mui-palette-primary-main)' : 'var(--mui-palette-customColors-trackBg)'
      ),
      states: {
        hover: {
          filter: { type: 'none' }
        },
        active: {
          filter: { type: 'none' }
        }
      },
      xaxis: {
        categories: weekly.categories,
        tickPlacement: 'on',
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false }
      },
      yaxis: {
        show: true,
        tickAmount: 4,
        labels: {
          offsetY: 2,
          offsetX: -17,
          style: { colors: disabled, fontSize: theme.typography.body2.fontSize },
          formatter: value => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value)))
        }
      }
    }),
    [divider, disabled, theme.typography.body2.fontSize, weekly.categories, weekly.series]
  )

  const performanceText =
    weekly.performancePercentage >= 0
      ? `${Math.abs(weekly.performancePercentage)}% better than last week`
      : `${Math.abs(weekly.performancePercentage)}% below last week`

  const syncLabel = useMemo(() => formatSyncLabel(isRefreshing, lastUpdatedAt), [isRefreshing, lastUpdatedAt])

  return (
    <Card>
      <CardHeader
        title='Weekly Overview'
        subheader={syncLabel}
        action={
          <OptionsMenu
            iconClassName='text-textPrimary'
            options={[
              {
                text: 'Refresh',
                menuItemProps: {
                  onClick: () => refreshNow?.()
                }
              }
            ]}
          />
        }
      />
      <CardContent sx={{ '& .apexcharts-xcrosshairs.apexcharts-active': { opacity: 0 } }}>
        <AppReactApexCharts
          type='bar'
          height={206}
          width='100%'
          series={[{ name: 'Collections', data: weekly.series }]}
          options={options}
        />
        <div className='flex items-center mbe-4 gap-4'>
          <Typography variant='h4'>{`${weekly.performancePercentage >= 0 ? '+' : '-'}${Math.abs(weekly.performancePercentage)}%`}</Typography>
          <Typography>{`This week: ${formatKESCompact(weekly.total)}. Performance is ${performanceText}.`}</Typography>
        </div>
        <Button fullWidth variant='contained' onClick={() => refreshNow?.()}>
          Sync Latest Data
        </Button>
      </CardContent>
    </Card>
  )
}

export default WeeklyOverview
