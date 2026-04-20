import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import { getTenantDashboardMetrics } from '@/libs/dashboard/getDashboardMetrics'
import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'

const TenantDashboardRealtime = dynamic(() => import('@/views/dashboard/TenantDashboardRealtime'), {
  suspense: true
})

const TenantDashboardPage = async () => {
  const { metrics, error } = await getTenantDashboardMetrics()

  return (
    <Suspense fallback={<DashboardPageSkeleton includeTable={false} />}>
      <TenantDashboardRealtime initialMetrics={metrics} initialError={error} />
    </Suspense>
  )
}

export default TenantDashboardPage
