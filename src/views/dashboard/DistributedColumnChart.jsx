'use client'

import { memo, useMemo } from 'react'

// Next Imports
import dynamic from 'next/dynamic'

//MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

// Vars
const DEFAULT_SERIES = [0, 0, 0, 0, 0]
const DEFAULT_TOTAL_LABEL = '0'
const DEFAULT_CAPTION = 'Audit Sessions'

const DistributedColumnChart = ({ seriesData, totalLabel = DEFAULT_TOTAL_LABEL, caption = DEFAULT_CAPTION }) => {
  // Hooks
  const theme = useTheme()
  const data = useMemo(() => (Array.isArray(seriesData) && seriesData.length ? seriesData : DEFAULT_SERIES), [seriesData])

  // Vars
  const primaryColor = 'var(--mui-palette-primary-main)'
  const errorColor = 'var(--mui-palette-error-main)'
  const trackBgColor = 'var(--mui-palette-customColors-trackBg)'

  const palette = useMemo(
    () => data.map((value, index) => (value > 0 && index % 2 === 0 ? errorColor : primaryColor)),
    [data, errorColor, primaryColor]
  )

  const options = useMemo(
    () => ({
      chart: {
        type: 'bar',
        stacked: false,
        parentHeightOffset: 0,
        toolbar: { show: false },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 360
        }
      },
      tooltip: {
        x: { show: false }
      },
      grid: {
        show: false,
        padding: {
          top: -10,
          left: -3,
          right: -2,
          bottom: 5
        }
      },
      legend: { show: false },
      dataLabels: { enabled: false },
      colors: palette,
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '24%',
          borderRadius: 4,
          borderRadiusApplication: 'around',
          borderRadiusWhenStacked: 'all',
          distributed: true,
          colors: {
            backgroundBarRadius: 5,
            backgroundBarColors: data.map(() => trackBgColor)
          }
        }
      },
      xaxis: {
        labels: { show: false },
        axisTicks: { show: false },
        axisBorder: { show: false }
      },
      yaxis: { show: false },
      responsive: [
        {
          breakpoint: 900,
          options: {
            plotOptions: {
              bar: {
                columnWidth: '18%'
              }
            }
          }
        },
        {
          breakpoint: theme.breakpoints.values.sm,
          options: {
            plotOptions: {
              bar: {
                columnWidth: '12%'
              }
            }
          }
        }
      ]
    }),
    [data, palette, theme.breakpoints.values.sm, trackBgColor]
  )

  return (
    <Card>
      <CardContent>
        <Typography variant='h4'>{totalLabel}</Typography>
        <AppReactApexCharts type='bar' height={88} width='100%' options={options} series={[{ name: caption, data }]} />
        <Typography color='text.primary' className='font-medium text-center'>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default memo(DistributedColumnChart)
