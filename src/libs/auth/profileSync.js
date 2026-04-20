import { isValidRole, normalizeRole } from './roles'

export const syncBasicProfile = async (supabase, user) => {
  if (!supabase || !user?.id) {
    return
  }

  const requestedRole = isValidRole(user.user_metadata?.requested_role) ? normalizeRole(user.user_metadata.requested_role) : null

  const profilePayload = {
    id: user.id,
    full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Account',
    phone: user.user_metadata?.phone ?? null,
    id_number: user.user_metadata?.id_number ?? null,
    occupation: user.user_metadata?.occupation ?? null
  }

  if (requestedRole) {
    profilePayload.requested_role = requestedRole
  }

  await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' })
}
