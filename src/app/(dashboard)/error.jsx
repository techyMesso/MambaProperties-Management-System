'use client'

import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

const DashboardError = ({ error, reset }) => {
  return (
    <Card className='mp-dashboard-section'>
      <CardContent className='flex flex-col gap-4'>
        <Typography variant='h4'>Dashboard Error</Typography>
        <Typography color='text.secondary'>
          {error?.message || 'Something went wrong while loading this dashboard section.'}
        </Typography>
        <div>
          <Button variant='contained' onClick={reset}>
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default DashboardError

