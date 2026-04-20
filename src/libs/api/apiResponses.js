import { randomUUID } from 'crypto'

import { NextResponse } from 'next/server.js'

import { API_ERROR_CODES, getDefaultApiErrorCode, toApiError } from './apiErrors.js'

const REQUEST_ID_HEADER = 'x-request-id'

const DEFAULT_SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0'
})

const PUBLIC_ERROR_MESSAGE_BY_STATUS = Object.freeze({
  400: 'Unable to process request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Request conflicts with an existing record',
  502: 'Upstream service request failed',
  413: 'Payload too large',
  429: 'Too many requests. Please try again shortly',
  500: 'Internal server error',
  503: 'Service unavailable'
})

const SENSITIVE_ERROR_PATTERNS = [
  /\b(relation|column|schema|table|function|operator)\b.+\bdoes not exist\b/i,
  /\bsyntax error at or near\b/i,
  /\bsqlstate\b/i,
  /\bpermission denied\b/i,
  /\brow[-\s]?level security\b/i,
  /\bviolates\b.+\bconstraint\b/i,
  /\bduplicate key value\b/i,
  /\bpostgres(ql)?\b/i,
  /\bpg_[a-z0-9_]+\b/i,
  /at\s+[^\s]+:\d+:\d+/i
]

const toText = value => String(value || '').trim()
const toSingleLineText = value => toText(value).replace(/\s+/g, ' ')

const normalizeErrorMessage = value => {
  const normalized = toSingleLineText(value || 'Request failed')

  if (!normalized) {
    return 'Request failed'
  }

  return normalized.replace(/[.!?]+$/, '')
}

const getPublicErrorFallback = status => PUBLIC_ERROR_MESSAGE_BY_STATUS[Number(status)] || 'Request failed'

const sanitizeErrorMessage = (message, status) => {
  const normalized = normalizeErrorMessage(message)

  if (!normalized) {
    return getPublicErrorFallback(status)
  }

  if (SENSITIVE_ERROR_PATTERNS.some(pattern => pattern.test(normalized))) {
    return getPublicErrorFallback(status)
  }

  return normalized
}

export const readRequestId = request => {
  const fromHeader = toText(request?.headers?.get(REQUEST_ID_HEADER))

  if (fromHeader) {
    return fromHeader
  }

  return randomUUID()
}

const withRequestIdHeader = (requestId, headers = {}) => ({
  ...DEFAULT_SECURITY_HEADERS,
  ...headers,
  [REQUEST_ID_HEADER]: requestId
})

export const jsonSuccess = (request, data, { status = 200, headers } = {}) => {
  const requestId = readRequestId(request)

  const payload =
    data && typeof data === 'object' && !Array.isArray(data)
      ? data
      : {
          data
        }

  return NextResponse.json(
    {
      success: true,
      ...payload,
      requestId
    },
    {
      status,
      headers: withRequestIdHeader(requestId, headers)
    }
  )
}

export const jsonError = (request, { status = 400, code, message = 'Request failed.', details = null } = {}, { headers } = {}) => {
  const requestId = readRequestId(request)
  const resolvedCode = code || getDefaultApiErrorCode(status)
  const errorMessage = sanitizeErrorMessage(message, status)

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      errorCode: resolvedCode,
      errorDetails: details,
      errorInfo: {
        code: resolvedCode,
        message: errorMessage,
        details
      },
      requestId
    },
    {
      status,
      headers: withRequestIdHeader(requestId, headers)
    }
  )
}

export const jsonFromError = (request, error, fallback = {}) => {
  const resolved = toApiError(error, fallback)

  return jsonError(request, {
    status: resolved.status,
    code: resolved.code,
    message: resolved.message,
    details: resolved.details
  })
}

export const API_RESPONSES = Object.freeze({
  ok: jsonSuccess,
  created: (request, data, options = {}) => jsonSuccess(request, data, { ...options, status: 201 }),
  accepted: (request, data, options = {}) => jsonSuccess(request, data, { ...options, status: 202 }),
  badRequest: (request, message = 'Bad request.', details = null) =>
    jsonError(request, { status: 400, code: API_ERROR_CODES.BAD_REQUEST, message, details }),
  unauthorized: (request, message = 'Unauthorized') =>
    jsonError(request, { status: 401, code: API_ERROR_CODES.UNAUTHORIZED, message }),
  forbidden: (request, message = 'Forbidden') =>
    jsonError(request, { status: 403, code: API_ERROR_CODES.FORBIDDEN, message }),
  notFound: (request, message = 'Not found') =>
    jsonError(request, { status: 404, code: API_ERROR_CODES.NOT_FOUND, message }),
  conflict: (request, message = 'Conflict', details = null) =>
    jsonError(request, { status: 409, code: API_ERROR_CODES.CONFLICT, message, details }),
  badGateway: (request, message = 'Upstream service request failed.', details = null) =>
    jsonError(request, { status: 502, code: API_ERROR_CODES.BAD_GATEWAY, message, details }),
  payloadTooLarge: (request, message = 'Payload too large', details = null) =>
    jsonError(request, { status: 413, code: API_ERROR_CODES.PAYLOAD_TOO_LARGE, message, details }),
  rateLimited: (request, message = 'Too many requests. Please try again shortly.', details = null, headers) =>
    jsonError(request, { status: 429, code: API_ERROR_CODES.RATE_LIMITED, message, details }, { headers }),
  unavailable: (request, message = 'Service unavailable') =>
    jsonError(request, { status: 503, code: API_ERROR_CODES.SERVICE_UNAVAILABLE, message }),
  internal: (request, message = 'Internal server error') =>
    jsonError(request, { status: 500, code: API_ERROR_CODES.INTERNAL_ERROR, message }),
  fromError: jsonFromError
})
