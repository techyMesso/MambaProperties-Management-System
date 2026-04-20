const readSupabaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL

  return typeof value === 'string' ? value.trim() : ''
}

const readSupabaseAnonKey = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return typeof value === 'string' ? value.trim() : ''
}

export const hasSupabaseEnv = () => {
  return Boolean(readSupabaseUrl() && readSupabaseAnonKey())
}

export const getSupabaseEnv = ({ required = true } = {}) => {
  const url = readSupabaseUrl()
  const anonKey = readSupabaseAnonKey()

  if (!url || !anonKey) {
    if (!required) {
      return null
    }

    const missingKey = !url ? 'NEXT_PUBLIC_SUPABASE_URL' : 'NEXT_PUBLIC_SUPABASE_ANON_KEY'

    throw new Error(`Missing required environment variable: ${missingKey}`)
  }

  return { url, anonKey }
}
