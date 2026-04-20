import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'
import { getModulePageData } from '@/libs/property/getModulePageData'

const PropertiesManagementPage = dynamic(() => import('@views/property/PropertiesManagementPage'), {
  suspense: true
})

const PropertiesPage = async () => {
  const pageData = await getModulePageData('properties')

  if (!pageData) {
    return null
  }

  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <PropertiesManagementPage {...pageData} />
    </Suspense>
  )
}

export default PropertiesPage
