import SubscriptionsPlansAdminView from '@views/admin/SubscriptionsPlansAdminView'
import { getModulePageData } from '@/libs/property/getModulePageData'

const SubscriptionsPlansPage = async () => {
  const initialData = await getModulePageData('subscriptions')

  if (!initialData) {
    return null
  }

  return <SubscriptionsPlansAdminView initialData={initialData} />
}

export default SubscriptionsPlansPage
