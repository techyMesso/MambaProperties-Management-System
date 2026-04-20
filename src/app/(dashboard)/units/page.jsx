import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'
import { getModulePageData } from '@/libs/property/getModulePageData'

const UnitsManagementPage = dynamic(() => import('@views/property/UnitsManagementPage'), {
  suspense: true
})

const UnitsPage = async ({ searchParams }) => {
  const pageData = await getModulePageData('units')

  if (!pageData) {
    return null
  }

  const resolvedSearchParams = (searchParams ? await searchParams : {}) || {}
  const plotFilter = resolvedSearchParams?.plot
  const initialPlotFilter = typeof plotFilter === 'string' ? plotFilter : Array.isArray(plotFilter) ? plotFilter[0] || '' : ''

  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <UnitsManagementPage {...pageData} initialPlotFilter={initialPlotFilter} />
    </Suspense>
  )
}

export default UnitsPage
