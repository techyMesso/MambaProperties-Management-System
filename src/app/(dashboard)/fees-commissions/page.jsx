import FeesCommissionsAdminView from '@views/admin/FeesCommissionsAdminView'
import { getModulePageData } from '@/libs/property/getModulePageData'

const FeesCommissionsPage = async () => {
  const initialData = await getModulePageData('fees')

  if (!initialData) {
    return null
  }

  return <FeesCommissionsAdminView initialData={initialData} />
}

export default FeesCommissionsPage
