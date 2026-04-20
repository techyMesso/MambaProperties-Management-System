export const API_ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BAD_GATEWAY: 'BAD_GATEWAY',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
})

const STATUS_TO_DEFAULT_CODE = {
  400: API_ERROR_CODES.BAD_REQUEST,
  401: API_ERROR_CODES.UNAUTHORIZED,
  403: API_ERROR_CODES.FORBIDDEN,
  404: API_ERROR_CODES.NOT_FOUND,
  409: API_ERROR_CODES.CONFLICT,
  502: API_ERROR_CODES.BAD_GATEWAY,
  422: API_ERROR_CODES.VALIDATION_ERROR,
  413: API_ERROR_CODES.PAYLOAD_TOO_LARGE,
  429: API_ERROR_CODES.RATE_LIMITED,
  500: API_ERROR_CODES.INTERNAL_ERROR,
  503: API_ERROR_CODES.SERVICE_UNAVAILABLE
}

export const getDefaultApiErrorCode = status => STATUS_TO_DEFAULT_CODE[Number(status)] || API_ERROR_CODES.BAD_REQUEST

export class ApiError extends Error {
  constructor({ status = 400, code, message = 'Request failed.', details = null } = {}) {
    super(String(message || 'Request failed.'))
    this.name = 'ApiError'
    this.status = Number(status) || 400
    this.code = code || getDefaultApiErrorCode(this.status)
    this.details = details
  }
}

export const toApiError = (value, fallback = {}) => {
  if (value instanceof ApiError) {
    return value
  }

  if (value && typeof value === 'object') {
    const message = String(value.message || fallback.message || 'Request failed.')
    const status = Number(value.status || fallback.status || 400)
    const code = value.code || fallback.code || getDefaultApiErrorCode(status)

    return new ApiError({
      status,
      code,
      message,
      details: value.details ?? fallback.details ?? null
    })
  }

  return new ApiError({
    status: Number(fallback.status || 400),
    code: fallback.code || getDefaultApiErrorCode(Number(fallback.status || 400)),
    message: String(fallback.message || 'Request failed.'),
    details: fallback.details ?? null
  })
}
