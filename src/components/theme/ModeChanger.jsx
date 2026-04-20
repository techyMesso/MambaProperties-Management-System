// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import { useColorScheme } from '@mui/material/styles'

// Hook Imports
import { useSettings } from '@core/hooks/useSettings'

const ModeChanger = () => {
  // Hooks
  const { setMode } = useColorScheme()
  const { settings } = useSettings()
  const hasMountedRef = useRef(false)

  useEffect(() => {
    if (settings.mode) {
      setMode(settings.mode)
    }

    if (typeof document === 'undefined' || !settings.mode) {
      return undefined
    }

    if (!hasMountedRef.current) {
      hasMountedRef.current = true

      return undefined
    }

    const root = document.documentElement

    root.classList.add('mp-theme-transitioning')

    const timeoutId = window.setTimeout(() => {
      root.classList.remove('mp-theme-transitioning')
    }, 260)

    return () => {
      window.clearTimeout(timeoutId)
      root.classList.remove('mp-theme-transitioning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode])

  return null
}

export default ModeChanger
