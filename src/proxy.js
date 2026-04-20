import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

import { buildMfaSetupPath, getMfaPolicyState } from './libs/auth/mfaPolicy'
import { buildLandlordPricingPath, resolvePostAuthRedirect } from './libs/auth/postAuthRedirect'
import { canAccessPath, DEFAULT_ROLE, getHomeForRole, isValidRole, normalizeRole } from './libs/auth/roles'
import { resolveUserRole } from './libs/auth/resolveRole'
import { checkLandlordApprovalStatus, checkManagementModuleAccess, checkMarketplaceListingAccess } from './libs/landlord/featureAccess'
import { buildContentSecurityPolicy } from './libs/security/csp'

const AUTH_ROUTES = ['/login', '/register', '/forgot-password']
const ALWAYS_PUBLIC_ROUTES = ['/', '/pricing', '/error', '/under-maintenance', '/auth', '/reset-password']
const TENANT_SUBSCRIPTION_REQUIRED_ROUTES = ['/marketplace']
const LANDLORD_MANAGEMENT_REQUIRED_ROUTES = ['/landlord-dashboard', '/agent-dashboard', '/subscription-center', '/properties', '/units', '/tenants', '/tenancies', '/payments', '/invoices', '/maintenance', '/messaging', '/documents', '/reports']
const LANDLORD_MARKETPLACE_REQUIRED_ROUTES = ['/marketplace']

const MFA_GUARDED_ROUTES = [
  '/admin-dashboard',
  '/admin',
  '/landlord-dashboard',
  '/agent-dashboard',
  '/subscription-center',
  '/properties',
  '/units',
  '/tenants',
  '/tenancies',
  '/payments',
  '/invoices',
  '/maintenance',
  '/messaging',
  '/documents',
  '/reports',
  '/landlord-verification',
  '/landlord-leads',
  '/onboarding-pipeline',
  '/subscriptions-plans',
  '/fees-commissions',
  '/income-analytics',
  '/user-management',
  '/payments-monitoring',
  '/audit-security',
  '/documents-review',
  '/system-settings'
]

const isAuthRoute = pathname => {
  return AUTH_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))
}

const isAlwaysPublicRoute = pathname => {
  return ALWAYS_PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))
}

const isStaticRoute = pathname => {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/assets/') ||
    /\.[^/]+$/.test(pathname)
  )
}

const buildLoginRedirect = request => {
  const loginUrl = request.nextUrl.clone()

  loginUrl.pathname = '/login'
  loginUrl.search = ''

  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`

  if (nextPath && nextPath !== '/login') {
    loginUrl.searchParams.set('next', nextPath)
  }

  return NextResponse.redirect(loginUrl)
}

const buildTenantSubscriptionRedirect = request => {
  const paymentsUrl = request.nextUrl.clone()
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`

  paymentsUrl.pathname = '/payments'
  paymentsUrl.searchParams.set('subscription', 'required')
  paymentsUrl.searchParams.set('returnTo', currentPath || '/marketplace?intent=search')

  return NextResponse.redirect(paymentsUrl)
}

const isLandlordManagementRequiredRoute = pathname =>
  LANDLORD_MANAGEMENT_REQUIRED_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))

const isLandlordMarketplaceRequiredRoute = pathname =>
  LANDLORD_MARKETPLACE_REQUIRED_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))

const isMfaGuardedRoute = pathname => MFA_GUARDED_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))

const buildLandlordUpgradeRedirect = ({ request, role, feature, destination = '/pricing' }) => {
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
  const pricingUrl = new URL(buildLandlordPricingPath(role), request.url)

  pricingUrl.pathname = destination
  pricingUrl.searchParams.set('upgrade', feature)
  pricingUrl.searchParams.set('next', currentPath || '/landlord-dashboard')

  return NextResponse.redirect(pricingUrl)
}

const isTenantSubscriptionRequiredRoute = pathname =>
  TENANT_SUBSCRIPTION_REQUIRED_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`))

const canIgnoreTenantSubscriptionCheck = error => {
  const message = String(error?.message || '').toLowerCase()

  // Only ignore specific schema-related errors, not all column/relation errors
  const schemaPatterns = [/relation .+ does not exist/, /column .+ does not exist/, /table .+ does not exist/]

  return schemaPatterns.some(pattern => pattern.test(message))
}

const hasTenantHouseSearchSubscription = async (supabase, userId) => {
  try {
    const { data, error } = await supabase
      .from('tenant_subscriptions')
      .select('id,status,payment_status,expires_at')
      .eq('user_id', userId)
      .eq('subscription_type', 'house_search')
      .eq('status', 'active')
      .eq('payment_status', 'paid')
      .limit(1)
      .maybeSingle()

    if (error) {
      if (canIgnoreTenantSubscriptionCheck(error)) {
        return true
      }

      console.error('Subscription check failed:', error)

      return false
    }

    if (!data?.id) {
      return false
    }

    if (!data.expires_at) {
      return true
    }

    return new Date(data.expires_at) > new Date()
  } catch (error) {
    if (canIgnoreTenantSubscriptionCheck(error)) {
      return true
    }

    console.error('Subscription check failed:', error)

    return false
  }
}

const isDev = process.env.NODE_ENV !== 'production'

const generateNonce = () => {
  const bytes = new Uint8Array(16)

  crypto.getRandomValues(bytes)

  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  if (typeof btoa === 'function') {
    return btoa(binary)
  }

  throw new Error('Cryptographic operations not available')
}

const applySecurityHeaders = (response, nonce) => {
  response.headers.set('Content-Security-Policy', buildContentSecurityPolicy({ nonce, isDev }))
  response.headers.set('x-nonce', nonce)

  return response
}

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const authRoute = isAuthRoute(pathname)
  const alwaysPublicRoute = isAlwaysPublicRoute(pathname)

  if (isStaticRoute(pathname)) {
    return NextResponse.next()
  }

  const nonce = generateNonce()
  const requestHeaders = new Headers(request.headers)

  requestHeaders.set('x-nonce', nonce)

  // Skip auth lookup for purely public pages to keep them fast.
  if (alwaysPublicRoute && !authRoute) {
    return applySecurityHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders
        }
      }),
      nonce
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing required Supabase environment variables')

    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

        response = NextResponse.next({
          request: {
            headers: requestHeaders
          }
        })

        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      }
    }
  })

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user && !authRoute && !alwaysPublicRoute) {
    return applySecurityHeaders(buildLoginRedirect(request), nonce)
  }

  if (!user) {
    return applySecurityHeaders(response, nonce)
  }

  const resolvedRole = await resolveUserRole(supabase, user)
  const role = isValidRole(resolvedRole) ? normalizeRole(resolvedRole) : DEFAULT_ROLE

  if (alwaysPublicRoute) {
    return applySecurityHeaders(response, nonce)
  }

  if (authRoute) {
    const redirectUrl = request.nextUrl.clone()
    const destinationPath = await resolvePostAuthRedirect({ supabase, user, resolvedRole: role })

    redirectUrl.pathname = destinationPath.split('?')[0] || getHomeForRole(role)
    redirectUrl.search = ''

    const destinationUrl = new URL(destinationPath, request.url)

    destinationUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value)
    })

    return applySecurityHeaders(NextResponse.redirect(redirectUrl), nonce)
  }

  if (!canAccessPath(pathname, role)) {
    const forbiddenUrl = request.nextUrl.clone()

    forbiddenUrl.pathname = '/error'
    forbiddenUrl.searchParams.set('code', '403')

    return applySecurityHeaders(NextResponse.redirect(forbiddenUrl), nonce)
  }

  if (isMfaGuardedRoute(pathname)) {
    const mfaPolicy = getMfaPolicyState({
      role,
      user
    })

    if (mfaPolicy.canEnforceSetup) {
      const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`
      const mfaSetupUrl = request.nextUrl.clone()
      const destinationUrl = new URL(buildMfaSetupPath(nextPath), request.url)

      mfaSetupUrl.pathname = destinationUrl.pathname
      mfaSetupUrl.search = destinationUrl.search

      return applySecurityHeaders(NextResponse.redirect(mfaSetupUrl), nonce)
    }
  }

  if (role === 'tenant' && isTenantSubscriptionRequiredRoute(pathname)) {
    const hasSubscription = await hasTenantHouseSearchSubscription(supabase, user.id)

    if (!hasSubscription) {
      return applySecurityHeaders(buildTenantSubscriptionRedirect(request), nonce)
    }
  }

  const isManagedLandlordRole = role === 'landlord' || role === 'agent'

  if (isManagedLandlordRole) {
    const needsManagementAccess = isLandlordManagementRequiredRoute(pathname)
    const needsMarketplaceAccess = isLandlordMarketplaceRequiredRoute(pathname)

    if (needsManagementAccess || needsMarketplaceAccess) {
      const approval = await checkLandlordApprovalStatus(supabase, user.id)

      if (!approval?.isApproved) {
        const approvalUrl = request.nextUrl.clone()

        approvalUrl.pathname = '/approval-pending'
        approvalUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}` || '/landlord-dashboard')

        return applySecurityHeaders(NextResponse.redirect(approvalUrl), nonce)
      }
    }

    if (needsManagementAccess) {
      const managementAccess = await checkManagementModuleAccess(supabase, user.id)

      if (!managementAccess?.hasAccess) {
        return applySecurityHeaders(
          buildLandlordUpgradeRedirect({ request, role, feature: 'management_module' }),
          nonce
        )
      }
    }

    if (needsMarketplaceAccess) {
      const marketplaceAccess = await checkMarketplaceListingAccess(supabase, user.id)

      if (!marketplaceAccess?.hasAccess) {
        return applySecurityHeaders(
          buildLandlordUpgradeRedirect({ request, role, feature: 'marketplace_listing' }),
          nonce
        )
      }
    }
  }

  return applySecurityHeaders(response, nonce)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)']
}
