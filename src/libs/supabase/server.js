import { cookies } from 'next/headers'

import { createServerClient } from '@supabase/ssr'

import { getSupabaseEnv } from './env'

export const createClient = async () => {
  const env = getSupabaseEnv({ required: false })

  if (!env) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Components can't always write cookies directly.
        }
      }
    }
  })
}
