import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'

const DashboardPageSkeleton = ({ includeTable = true }) => {
  return (
    <Grid container spacing={6}>
      <Grid item xs={12}>
        <Skeleton variant='rounded' height={120} />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Skeleton variant='rounded' height={124} />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Skeleton variant='rounded' height={124} />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Skeleton variant='rounded' height={124} />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Skeleton variant='rounded' height={124} />
      </Grid>
      {includeTable ? (
        <Grid item xs={12}>
          <Skeleton variant='rounded' height={360} />
        </Grid>
      ) : null}
    </Grid>
  )
}

export default DashboardPageSkeleton

