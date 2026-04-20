import { NextResponse } from 'next/server'

import { syncBasicProfile } from '@/libs/auth/profileSync'
import { resolvePostAuthRedirect } from '@/libs/auth/postAuthRedirect'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const sanitizeNextPath = value => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null
  }

  return trimmed
}

const withVerifiedFlag = path => {
  const url = new URL(path, 'http://localhost')

  if (!url.searchParams.has('verified')) {
    url.searchParams.set('verified', '1')
  }

  return `${url.pathname}${url.search}`
}

const buildRedirectUrl = (request, destinationPath) => {
  const safeDestinationPath = sanitizeNextPath(destinationPath) || '/tenant-dashboard?verified=1'
  const verifiedDestinationPath = withVerifiedFlag(safeDestinationPath)

  return new URL(verifiedDestinationPath, request.url)
}

const buildErrorRedirect = (request, message) => {
  const loginUrl = new URL('/login', request.url)

  loginUrl.searchParams.set('message', message)

  return NextResponse.redirect(loginUrl)
}

export async function GET(request) {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return buildErrorRedirect(request, 'Supabase is not configured.')
  }

  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const code = request.nextUrl.searchParams.get('code')

  let authError = null

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type
    })

    authError = error
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    authError = error
  }

  if (authError) {
    return buildErrorRedirect(request, authError.message || 'Unable to verify your email link.')
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return buildErrorRedirect(request, 'Verification completed, but we could not start your session. Please sign in once.')
  }

  await syncBasicProfile(supabase, user)

  const requestedNext = sanitizeNextPath(request.nextUrl.searchParams.get('next'))
  const fallbackRedirect = await resolvePostAuthRedirect({ supabase, user })

  return NextResponse.redirect(buildRedirectUrl(request, requestedNext || fallbackRedirect))
}
