import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'

const ModulePageServer = dynamic(() => import('@views/property/ModulePageServer'), {
  suspense: true
})

const ReportsPage = () => {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <ModulePageServer moduleKey='reports' />
    </Suspense>
  )
}

export default ReportsPage
