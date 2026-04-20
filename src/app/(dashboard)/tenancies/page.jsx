import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'
import { getModulePageData } from '@/libs/property/getModulePageData'

const TenanciesManagementPage = dynamic(() => import('@views/property/TenanciesManagementPage'), {
  suspense: true
})

const TenanciesPage = async () => {
  const pageData = await getModulePageData('tenancies')

  if (!pageData) {
    return null
  }

  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <TenanciesManagementPage {...pageData} />
    </Suspense>
  )
}

export default TenanciesPage
