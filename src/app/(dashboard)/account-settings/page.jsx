// Next Imports
import dynamic from 'next/dynamic'

// Component Imports
import AccountSettings from '@views/account-settings'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const AccountTab = dynamic(() => import('@views/account-settings/account'))

const AccountSettingsPage = async () => {
  const supabase = await createServerSupabaseClient()
  let role = USER_ROLES.TENANT

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (user?.id) {
      role = await resolveUserRole(supabase, user)
    }
  }

  const tabContentList = {
    account: <AccountTab role={role} />
  }

  return <AccountSettings tabContentList={tabContentList} />
}

export default AccountSettingsPage
