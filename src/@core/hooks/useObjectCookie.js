// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { useCookie } from 'react-use'

export const useObjectCookie = (key, fallback) => {
  // Hooks
  const [valStr, updateCookie] = useCookie(key)

  const parseCookieValue = value => {
    if (!value) {
      return fallback
    }

    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => parseCookieValue(valStr), [valStr])

  const updateValue = newVal => {
    updateCookie(JSON.stringify(newVal))
  }

  return [value, updateValue]
}
