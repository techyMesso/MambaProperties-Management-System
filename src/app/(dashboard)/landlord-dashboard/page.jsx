import { redirect } from 'next/navigation'
import { Suspense } from 'react'

import dynamic from 'next/dynamic'

import { resolvePostAuthRedirect } from '@/libs/auth/postAuthRedirect'
import { getLandlordDashboardMetrics } from '@/libs/dashboard/getDashboardMetrics'
import { loadLandlordSubscriptionOverview } from '@/libs/landlord/subscriptionOverview'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'
import DashboardPageSkeleton from '@components/skeletons/DashboardPageSkeleton'

const LandlordDashboardRealtime = dynamic(() => import('@/views/dashboard/LandlordDashboardRealtime'), {
  suspense: true
})

const LandlordDashboardPage = async () => {
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

  if (redirectTo !== '/landlord-dashboard') {
    redirect(redirectTo)
  }

  const [{ metrics, error }, subscriptionOverview] = await Promise.all([
    getLandlordDashboardMetrics(),
    loadLandlordSubscriptionOverview({ supabase, userId: user.id })
  ])

  return (
    <Suspense fallback={<DashboardPageSkeleton includeTable={false} />}>
      <LandlordDashboardRealtime initialMetrics={metrics} initialError={error} subscriptionOverview={subscriptionOverview} />
    </Suspense>
  )
}

export default LandlordDashboardPage
