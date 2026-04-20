import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'
import { getModulePageData } from '@/libs/property/getModulePageData'

const TenantsManagementPage = dynamic(() => import('@views/property/TenantsManagementPage'), {
  suspense: true
})

const TenantsPage = async () => {
  const pageData = await getModulePageData('tenants')

  if (!pageData) {
    return null
  }

  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <TenantsManagementPage {...pageData} />
    </Suspense>
  )
}

export default TenantsPage
