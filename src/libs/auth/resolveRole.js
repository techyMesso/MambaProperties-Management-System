import { DEFAULT_ROLE, isValidRole, normalizeRole } from './roles'
import { createAuthPerfLogger } from './perf'

export const readRoleFromUser = user => {
  // Only trust app_metadata roles set by privileged backend flows.
  const metadataRole = user?.app_metadata?.role

  if (isValidRole(metadataRole)) {
    return normalizeRole(metadataRole)
  }

  return null
}

export const resolveUserRole = async (supabase, user) => {
  const perf = createAuthPerfLogger('auth.resolve-role', {
    hasUser: Boolean(user?.id)
  })

  if (!user?.id || !supabase) {
    perf.mark('fallback-default-missing-user-or-client')
    perf.done({
      source: 'default'
    })

    return DEFAULT_ROLE
  }

  const metadataRole = readRoleFromUser(user)

  try {
    perf.mark('profile-query-start')
    const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

    perf.mark('profile-query-end', { hasError: Boolean(error) })

    if (!error && isValidRole(data?.role)) {
      const profileRole = normalizeRole(data.role)

      if (metadataRole && metadataRole !== profileRole) {
        perf.mark('role-mismatch', {
          metadataRole,
          profileRole
        })
      }

      perf.done({
        source: 'profiles',
        role: profileRole
      })

      return profileRole
    }
  } catch {
    // Profiles table or policy may not exist yet; fallback below.
    perf.mark('profile-query-throw')
  }

  if (metadataRole) {
    perf.mark('metadata-role-hit', { role: metadataRole })
    perf.done({
      source: 'app_metadata',
      role: metadataRole
    })

    return metadataRole
  }

  perf.done({
    source: 'default',
    role: DEFAULT_ROLE
  })

  return DEFAULT_ROLE
}
