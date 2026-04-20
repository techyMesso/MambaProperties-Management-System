'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { DEFAULT_ROLE } from '@/libs/auth/roles'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { createBrowserSupabaseClient } from '@/libs/supabase'

const createInitialState = () => ({
  loading: true,
  user: null,
  role: DEFAULT_ROLE
})

const AuthSessionContext = createContext(createInitialState())

export const AuthSessionProvider = ({ children }) => {
  const [state, setState] = useState(createInitialState)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  useEffect(() => {
    if (!supabase) {
      setState({
        loading: false,
        user: null,
        role: DEFAULT_ROLE
      })

      return undefined
    }

    let isActive = true

    const setFromUser = async user => {
      if (!isActive) {
        return
      }

      if (!user) {
        setState({
          loading: false,
          user: null,
          role: DEFAULT_ROLE
        })

        return
      }

      const role = await resolveUserRole(supabase, user)

      if (!isActive) {
        return
      }

      setState({
        loading: false,
        user,
        role: role || DEFAULT_ROLE
      })
    }

    const bootstrap = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()

        await setFromUser(session?.user || null)
      } catch {
        if (!isActive) {
          return
        }

        setState({
          loading: false,
          user: null,
          role: DEFAULT_ROLE
        })
      }
    }

    bootstrap()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await setFromUser(session?.user || null)
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo(() => ({ ...state, supabase }), [state, supabase])

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export const useAuthSession = () => useContext(AuthSessionContext)
