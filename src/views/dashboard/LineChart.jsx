'use client'

import { memo, useMemo } from 'react'

// Next Imports
import dynamic from 'next/dynamic'

//MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

// Vars
const DEFAULT_SERIES = [0, 0, 0, 0, 0, 0]
const DEFAULT_TOTAL_LABEL = 'KES 0'
const DEFAULT_CAPTION = 'Platform Transactions'

const LineChart = ({ seriesData, totalLabel = DEFAULT_TOTAL_LABEL, caption = DEFAULT_CAPTION }) => {
  const data = useMemo(() => (Array.isArray(seriesData) && seriesData.length ? seriesData : DEFAULT_SERIES), [seriesData])
  const primaryColor = 'var(--mui-palette-primary-main)'

  const options = useMemo(
    () => ({
      chart: {
        parentHeightOffset: 0,
        toolbar: { show: false },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 360
        }
      },
      tooltip: { enabled: false },
      grid: {
        strokeDashArray: 6,
        borderColor: 'var(--mui-palette-divider)',
        xaxis: {
          lines: { show: true }
        },
        yaxis: {
          lines: { show: false }
        },
        padding: {
          top: -10,
          left: -7,
          right: 5,
          bottom: 5
        }
      },
      stroke: {
        width: 3,
        lineCap: 'butt',
        curve: 'straight'
      },
      colors: [primaryColor],
      markers: {
        size: 6,
        offsetY: 4,
        offsetX: -2,
        strokeWidth: 3,
        colors: ['transparent'],
        strokeColors: 'transparent',
        discrete: [
          {
            size: 5.5,
            seriesIndex: 0,
            strokeColor: primaryColor,
            fillColor: 'var(--mui-palette-background-paper)',
            dataPointIndex: Math.max(0, data.length - 1)
          }
        ]
      },
      xaxis: {
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false }
      },
      yaxis: {
        labels: { show: false }
      }
    }),
    [data.length, primaryColor]
  )

  return (
    <Card>
      <CardContent>
        <Typography variant='h4'>{totalLabel}</Typography>
        <AppReactApexCharts type='line' height={88} width='100%' options={options} series={[{ data }]} />
        <Typography color='text.primary' className='font-medium text-center'>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default memo(LineChart)
