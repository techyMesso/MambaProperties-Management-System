import 'server-only'

// Next Imports
import { cookies } from 'next/headers'

// Config Imports
import themeConfig from '@configs/themeConfig'

export const getSettingsFromCookie = async () => {
  const cookieStore = await cookies()
  const cookieName = themeConfig.settingsCookieName
  const rawSettings = cookieStore.get(cookieName)?.value || '{}'

  try {
    return JSON.parse(rawSettings)
  } catch {
    return {}
  }
}

export const getMode = async () => {
  const settingsCookie = await getSettingsFromCookie()

  // Get mode from cookie or fallback to theme config
  const _mode = settingsCookie.mode || themeConfig.mode

  return _mode
}

export const getSystemMode = async () => {
  const mode = await getMode()

  return mode
}

export const getServerMode = async () => {
  const mode = await getMode()

  return mode
}
