import { useMemo } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

// Components Imports
import OptionMenu from '@core/components/option-menu'

const DEFAULT_TOTAL_EARNING = {
  totalCollected: 'KES 0',
  trendPercentage: 0,
  trendDirection: 'up',
  comparisonLabel: 'Compared to KES 0 last month',
  channels: []
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

const TotalEarning = ({ totalEarning, refreshNow, isRefreshing = false, lastUpdatedAt = null }) => {
  const earning = totalEarning || DEFAULT_TOTAL_EARNING

  const channelRows = useMemo(
    () =>
      earning.channels?.length
        ? earning.channels
        : [
            {
              key: 'no-channel-data',
              title: 'No channel data yet',
              subtitle: 'Payments will appear once rent collections are recorded.',
              amount: 'KES 0',
              progress: 0,
              color: 'primary',
              icon: 'ri-exchange-funds-line'
            }
          ],
    [earning.channels]
  )

  const syncLabel = useMemo(() => formatSyncLabel(isRefreshing, lastUpdatedAt), [isRefreshing, lastUpdatedAt])

  return (
    <Card>
      <CardHeader
        title='Total Earning'
        subheader={syncLabel}
        action={
          <OptionMenu
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
      ></CardHeader>
      <CardContent className='flex flex-col gap-11 md:mbs-2.5'>
        <div>
          <div className='flex items-center'>
            <Typography variant='h3'>{earning.totalCollected}</Typography>
            <i
              className={`align-bottom ${earning.trendDirection === 'down' ? 'ri-arrow-down-s-line text-error' : 'ri-arrow-up-s-line text-success'}`}
            ></i>
            <Typography component='span' color={earning.trendDirection === 'down' ? 'error.main' : 'success.main'}>
              {`${Math.abs(earning.trendPercentage)}%`}
            </Typography>
          </div>
          <Typography>{earning.comparisonLabel}</Typography>
        </div>
        <div className='flex flex-col gap-6'>
          {channelRows.map(item => (
            <div key={item.key} className='flex items-center gap-3'>
              <Avatar variant='rounded' className='bg-actionHover'>
                <i className={item.icon || 'ri-exchange-funds-line'} />
              </Avatar>
              <div className='flex justify-between items-center is-full flex-wrap gap-x-4 gap-y-2'>
                <div className='flex flex-col gap-0.5'>
                  <Typography color='text.primary' className='font-medium'>
                    {item.title}
                  </Typography>
                  <Typography>{item.subtitle}</Typography>
                </div>
                <div className='flex flex-col gap-2 items-center'>
                  <Typography color='text.primary' className='font-medium'>
                    {item.amount}
                  </Typography>
                  <LinearProgress
                    variant='determinate'
                    value={item.progress}
                    className='is-20 bs-1'
                    color={item.color || 'primary'}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default TotalEarning
