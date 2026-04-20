import { API_RESPONSES } from '@/libs/api/apiResponses'
import { resolveUserRole } from '@/libs/auth/resolveRole'
import { USER_ROLES } from '@/libs/auth/roles'
import { getMpesaConfig, requestMpesaAccessToken } from '@/libs/payments/mpesa'
import { createClient as createServerSupabaseClient } from '@/libs/supabase/server'

const isLocalDebugHost = request => {
  const host = String(request?.headers?.get('host') || '')
    .trim()
    .toLowerCase()

  return host.startsWith('localhost:') || host.startsWith('127.0.0.1:') || host === 'localhost' || host === '127.0.0.1'
}

export async function GET(request) {
  const debugAllowed = process.env.NODE_ENV !== 'production' && isLocalDebugHost(request)

  if (!debugAllowed) {
    return API_RESPONSES.notFound(request, 'Debug endpoint is disabled.')
  }

  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return API_RESPONSES.unavailable(request, 'Supabase is not configured.')
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return API_RESPONSES.unauthorized(request)
  }

  const role = await resolveUserRole(supabase, user)

  if (role !== USER_ROLES.ADMIN) {
    return API_RESPONSES.forbidden(request, 'Only admin accounts can access this debug endpoint.')
  }

  const config = getMpesaConfig({ required: false })

  const probe = String(request.nextUrl.searchParams.get('probe') || '')
    .trim()
    .toLowerCase()

  let oauthProbe = null

  if (probe === 'oauth') {
    try {
      const requiredConfig = getMpesaConfig()

      const token = await requestMpesaAccessToken(requiredConfig)

      oauthProbe = {
        ok: true,
        tokenIssued: Boolean(token)
      }
    } catch (error) {
      oauthProbe = {
        ok: false,
        error: String(error?.message || 'OAuth probe failed.'),
        errorType: error?.constructor?.name || 'Error',

        // Check for common credential issues
        isCredentialError:
          error?.message?.toLowerCase().includes('credential') ||
          error?.message?.toLowerCase().includes('invalid') ||
          error?.message?.toLowerCase().includes('unauthorized')
      }
    }
  }

  return API_RESPONSES.ok(request, {
    nodeEnv: process.env.NODE_ENV || 'development',
    debugAllowed: true,
    user: {
      id: user.id,
      role
    },
    config: {
      environment: config.environment || '',
      transactionType: config.transactionType || '',
      callbackUrl: config.callbackUrl || '',
      consumerKeyConfigured: Boolean(String(config.consumerKey || '').trim()),
      consumerSecretConfigured: Boolean(String(config.consumerSecret || '').trim()),
      shortcodeConfigured: Boolean(String(config.shortcode || '').trim()),
      passkeyConfigured: Boolean(String(config.passkey || '').trim()),
      allowUnsignedCallbacks: process.env.MPESA_ALLOW_UNSIGNED_CALLBACKS === '1'
    },
    oauthProbe
  })
}
