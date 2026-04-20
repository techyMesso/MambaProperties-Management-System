import ModulePage from './ModulePage'

import { getModulePageData } from '@/libs/property/getModulePageData'

const ModulePageServer = async ({ moduleKey }) => {
  const pageData = await getModulePageData(moduleKey)

  if (!pageData) {
    return null
  }

  return <ModulePage {...pageData} />
}

export default ModulePageServer
