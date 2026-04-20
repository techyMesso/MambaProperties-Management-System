import { API_RESPONSES } from '../api/apiResponses.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const toText = value => String(value || '').trim()

const toOrigin = value => {
  const input = toText(value)

  if (!input) {
    return ''
  }

  try {
    const parsed = new URL(input)

    return `${parsed.protocol}//${parsed.host}`.toLowerCase()
  } catch {
    return ''
  }
}

const getExpectedOrigin = request => {
  const configured = toOrigin(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL)

  if (configured) {
    return configured
  }

  const host = toText(request.headers.get('x-forwarded-host') || request.headers.get('host'))

  if (!host) {
    return ''
  }

  const forwardedProto = toText(request.headers.get('x-forwarded-proto')).toLowerCase()

  const protocol = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : process.env.NODE_ENV === 'development'
      ? 'http'
      : 'https'

  return `${protocol}://${host}`.toLowerCase()
}

export const enforceSameOriginMutation = request => {
  const method = toText(request?.method || '').toUpperCase()

  if (SAFE_METHODS.has(method)) {
    return null
  }

  const expectedOrigin = getExpectedOrigin(request)

  if (!expectedOrigin) {
    return null
  }

  const origin = toOrigin(request.headers.get('origin'))
  const refererOrigin = toOrigin(request.headers.get('referer'))
  const candidate = origin || refererOrigin

  if (!candidate || candidate !== expectedOrigin) {
    return API_RESPONSES.forbidden(request, 'Forbidden request origin.')
  }

  return null
}

export const getStoragePathOwnerId = path => {
  const normalized = toText(path)
  const firstSegment = normalized.split('/').filter(Boolean)[0] || ''

  if (!UUID_REGEX.test(firstSegment)) {
    return ''
  }

  return firstSegment
}

export const isStoragePathOwnedByUser = (path, userId) => {
  const normalizedPath = toText(path)
  const normalizedUserId = toText(userId)

  if (!normalizedPath || !normalizedUserId) {
    return false
  }

  return normalizedPath.startsWith(`${normalizedUserId}/`)
}

export const enforceRequestSizeLimit = (request, { maxBytes, message } = {}) => {
  const limit = Number(maxBytes)

  if (!Number.isFinite(limit) || limit <= 0) {
    return null
  }

  const lengthHeader = toText(request?.headers?.get('content-length'))

  if (!lengthHeader) {
    return null
  }

  const contentLength = Number(lengthHeader)

  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    return null
  }

  if (contentLength > limit) {
    return API_RESPONSES.payloadTooLarge(request, message || 'Request payload is too large.')
  }

  return null
}
