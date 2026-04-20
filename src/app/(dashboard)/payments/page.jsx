import ModulePageServer from '@views/property/ModulePageServer'
import TenantPaymentsWorkspace from '@views/property/TenantPaymentsWorkspace'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const PaymentsPage = async () => {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return <ModulePageServer moduleKey='payments' />
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return <ModulePageServer moduleKey='payments' />
  }

  const role = await resolveUserRole(supabase, user)

  if (role === USER_ROLES.TENANT) {
    return <TenantPaymentsWorkspace />
  }

  return <ModulePageServer moduleKey='payments' />
}

export default PaymentsPage
