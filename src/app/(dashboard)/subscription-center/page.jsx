import { redirect } from 'next/navigation'

import SubscriptionCenterView from '@/views/dashboard/SubscriptionCenterView'
import { resolvePostAuthRedirect } from '@/libs/auth/postAuthRedirect'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { loadLandlordSubscriptionOverview } from '@/libs/landlord/subscriptionOverview'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const SubscriptionCenterPage = async () => {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    redirect('/login')
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    redirect('/login')
  }

  const role = await resolveUserRole(supabase, user)

  if (![USER_ROLES.LANDLORD, USER_ROLES.AGENT].includes(role)) {
    const redirectTo = await resolvePostAuthRedirect({ supabase, user, resolvedRole: role })

    redirect(redirectTo)
  }

  const redirectTo = await resolvePostAuthRedirect({ supabase, user, resolvedRole: role })

  if (!['/landlord-dashboard', '/agent-dashboard', '/subscription-center'].includes(redirectTo)) {
    redirect(redirectTo)
  }

  const overview = await loadLandlordSubscriptionOverview({
    supabase,
    userId: user.id
  })

  return <SubscriptionCenterView overview={overview} role={role} />
}

export const dynamic = 'force-dynamic'

export default SubscriptionCenterPage
