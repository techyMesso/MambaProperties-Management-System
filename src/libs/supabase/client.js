'use client'

import { createBrowserClient } from '@supabase/ssr'

import { getSupabaseEnv } from './env'

let browserClient

export const createClient = () => {
  if (!browserClient) {
    const env = getSupabaseEnv({ required: false })

    if (!env) {
      return null
    }

    browserClient = createBrowserClient(env.url, env.anonKey)
  }

  return browserClient
}
