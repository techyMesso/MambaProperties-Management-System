import ApprovalPendingView from '@/views/onboarding/ApprovalPendingView'
import { loadApprovalPendingState } from '@/libs/auth/loadApprovalPendingState'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const ApprovalPendingPage = async () => {
  const supabase = await createServerSupabaseClient()
  let initialState = null

  if (supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    initialState = await loadApprovalPendingState({
      supabase,
      userId: user?.id || null
    })
  }

  return <ApprovalPendingView initialState={initialState} />
}

export const dynamic = 'force-dynamic'

export default ApprovalPendingPage
