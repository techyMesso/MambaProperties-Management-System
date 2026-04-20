const DEV_CONNECT_SOURCES = ['http://localhost:*', 'ws://localhost:*']

const PROD_CONNECT_SOURCES = ['https://*.supabase.co', 'wss://*.supabase.co', 'https://api.safaricom.co.ke', 'https://sandbox.safaricom.co.ke']

const toConnectDirective = isDev => {
  const sources = isDev ? [...DEV_CONNECT_SOURCES, ...PROD_CONNECT_SOURCES] : PROD_CONNECT_SOURCES

  return `connect-src 'self' ${sources.join(' ')}`
}

export const buildContentSecurityPolicy = ({ nonce, isDev = process.env.NODE_ENV !== 'production' } = {}) => {
  const normalizedNonce = typeof nonce === 'string' ? nonce.trim() : ''

  const scriptDirective = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : normalizedNonce
      ? `script-src 'self' 'nonce-${normalizedNonce}' 'strict-dynamic'`
      : "script-src 'self'"

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptDirective,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    toConnectDirective(isDev),
    "frame-src 'self'",
    'upgrade-insecure-requests'
  ].join('; ')
}
