import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'

const AnalyticsPanelSkeleton = () => {
  return (
    <Grid container spacing={6} className='mt-1'>
      <Grid item xs={12} md={6}>
        <Skeleton variant='rounded' height={280} />
      </Grid>
      <Grid item xs={12} md={6}>
        <Skeleton variant='rounded' height={280} />
      </Grid>
    </Grid>
  )
}

export default AnalyticsPanelSkeleton

