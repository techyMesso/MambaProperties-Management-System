import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import { getAdminDashboardMetrics } from '@/libs/dashboard/getDashboardMetrics'
import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'

const AdminDashboardRealtime = dynamic(() => import('@/views/dashboard/AdminDashboardRealtime'), {
  suspense: true
})

const AdminDashboardPage = async () => {
  const { metrics, error } = await getAdminDashboardMetrics()

  return (
    <Suspense fallback={<DashboardPageSkeleton includeTable={false} />}>
      <AdminDashboardRealtime initialMetrics={metrics} initialError={error} />
    </Suspense>
  )
}

export default AdminDashboardPage
