import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'

const DashboardLoading = () => {
  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Skeleton variant='rounded' height={136} />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Skeleton variant='rounded' height={140} />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Skeleton variant='rounded' height={140} />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Skeleton variant='rounded' height={140} />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Skeleton variant='rounded' height={140} />
      </Grid>
      <Grid item xs={12}>
        <Skeleton variant='rounded' height={320} />
      </Grid>
    </Grid>
  )
}

export default DashboardLoading
