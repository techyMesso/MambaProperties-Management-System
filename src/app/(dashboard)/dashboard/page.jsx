import { redirect } from 'next/navigation'

import { resolvePostAuthRedirect } from '@/libs/auth/postAuthRedirect'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const DashboardRedirectPage = async () => {
  try {
    const supabase = await createServerSupabaseClient()

    if (!supabase) {
      redirect('/')
    }

    const {
      data: { user }
    } = await supabase.auth.getUser()

    const role = await resolveUserRole(supabase, user)
    const redirectTo = await resolvePostAuthRedirect({ supabase, user, resolvedRole: role })

    redirect(redirectTo)
  } catch {
    redirect('/login')
  }
}

export default DashboardRedirectPage
