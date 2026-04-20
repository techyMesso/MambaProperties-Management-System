import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import { resolvePostAuthRedirect } from '@/libs/auth/postAuthRedirect'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { getAgentDashboardMetrics } from '@/libs/dashboard/getDashboardMetrics'
import { loadLandlordSubscriptionOverview } from '@/libs/landlord/subscriptionOverview'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'

const AgentDashboardRealtime = dynamic(() => import('@/views/dashboard/AgentDashboardRealtime'), {
  suspense: true
})

const AgentDashboardPage = async () => {
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
  const redirectTo = await resolvePostAuthRedirect({ supabase, user, resolvedRole: role })

  if (redirectTo !== '/agent-dashboard') {
    redirect(redirectTo)
  }

  const [{ metrics, error }, subscriptionOverview] = await Promise.all([
    getAgentDashboardMetrics(),
    loadLandlordSubscriptionOverview({ supabase, userId: user.id })
  ])

  return (
    <Suspense fallback={<DashboardPageSkeleton includeTable={false} />}>
      <AgentDashboardRealtime initialMetrics={metrics} initialError={error} subscriptionOverview={subscriptionOverview} />
    </Suspense>
  )
}

export default AgentDashboardPage
