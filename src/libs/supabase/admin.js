import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { getSupabaseEnv } from './env'

let adminClient

const readServiceRoleKey = () => {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY

  return typeof value === 'string' ? value.trim() : ''
}

export const hasServiceRoleKey = () => Boolean(readServiceRoleKey())

export const createAdminClient = () => {
  if (adminClient) {
    return adminClient
  }

  const env = getSupabaseEnv({ required: false })
  const serviceRoleKey = readServiceRoleKey()

  if (!env || !serviceRoleKey) {
    return null
  }

  adminClient = createClient(env.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })

  return adminClient
}
