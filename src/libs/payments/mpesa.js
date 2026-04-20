import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

const VALID_ENVIRONMENTS = new Set(['sandbox', 'production'])
const DEFAULT_TRANSACTION_TYPE = 'CustomerPayBillOnline'
const DEFAULT_MPESA_TIMEZONE = 'Africa/Nairobi'
const MPESA_DEBUG = process.env.NODE_ENV !== 'production'

const toString = value => (typeof value === 'string' ? value.trim() : '')

const maskPhone = value => {
  const text = toString(value)

  if (!text) {
    return ''
  }

  return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`
}

const debugLog = (message, payload) => {
  if (!MPESA_DEBUG) {
    return
  }

  if (payload === undefined) {
    console.log(message)

    return
  }

  console.log(message, payload)
}

const safeCompare = (left, right) => {
  const leftText = toString(left)
  const rightText = toString(right)

  if (!leftText || !rightText) {
    return false
  }

  const leftBuffer = Buffer.from(leftText)
  const rightBuffer = Buffer.from(rightText)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  try {
    return timingSafeEqual(leftBuffer, rightBuffer)
  } catch {
    return false
  }
}

const readConfig = () => {
  const environment = toString(process.env.MPESA_ENV).toLowerCase() || 'sandbox'

  return {
    environment,
    consumerKey: toString(process.env.MPESA_CONSUMER_KEY),
    consumerSecret: toString(process.env.MPESA_CONSUMER_SECRET),
    shortcode: toString(process.env.MPESA_SHORTCODE),
    passkey: toString(process.env.MPESA_PASSKEY),
    callbackUrl: toString(process.env.MPESA_CALLBACK_URL),
    transactionType: toString(process.env.MPESA_TRANSACTION_TYPE) || DEFAULT_TRANSACTION_TYPE
  }
}

const ensureConfig = config => {
  if (!VALID_ENVIRONMENTS.has(config.environment)) {
    throw new Error('Invalid MPESA_ENV. Use sandbox or production.')
  }

  const requiredKeys = [
    ['MPESA_CONSUMER_KEY', config.consumerKey],
    ['MPESA_CONSUMER_SECRET', config.consumerSecret],
    ['MPESA_SHORTCODE', config.shortcode],
    ['MPESA_PASSKEY', config.passkey],
    ['MPESA_CALLBACK_URL', config.callbackUrl]
  ]

  const missing = requiredKeys.find(([, value]) => !value)

  if (missing) {
    throw new Error(`Missing required M-Pesa environment variable: ${missing[0]}`)
  }
}

export const getMpesaConfig = ({ required = true } = {}) => {
  const config = readConfig()

  if (!required) {
    return config
  }

  ensureConfig(config)

  return config
}

export const getMpesaCallbackConfig = () => ({
  signatureHeader: toString(process.env.MPESA_CALLBACK_SIGNATURE_HEADER).toLowerCase() || 'x-mpesa-signature',
  callbackSecrets: [
    toString(process.env.MPESA_CALLBACK_SECRET),
    ...String(process.env.MPESA_CALLBACK_SECRETS || '')
      .split(',')
      .map(value => toString(value))
  ].filter(Boolean),
  allowUnsignedCallbacks: toString(process.env.MPESA_ALLOW_UNSIGNED_CALLBACKS) === '1',
  allowMissingTimestamp: toString(process.env.MPESA_CALLBACK_ALLOW_MISSING_TIMESTAMP) === '1',
  maxAgeSeconds: Number(process.env.MPESA_CALLBACK_MAX_AGE_SECONDS || 600),
  allowedIps: String(process.env.MPESA_CALLBACK_IP_ALLOWLIST || '')
    .split(',')
    .map(value => toString(value))
    .filter(Boolean)
})

export const verifyMpesaCallbackSignature = ({
  rawPayload,
  providedSignature,
  callbackSecret,
  callbackSecrets
} = {}) => {
  const payload = typeof rawPayload === 'string' ? rawPayload : ''
  const received = toString(providedSignature).replace(/^sha256=/i, '')

  const secrets =
    Array.isArray(callbackSecrets) && callbackSecrets.length ? callbackSecrets : callbackSecret ? [callbackSecret] : []

  if (!secrets.length) {
    return {
      ok: false,
      reason: 'M-Pesa callback secret is not configured.'
    }
  }

  if (!payload || !received) {
    return {
      ok: false,
      reason: 'Missing callback payload or signature.'
    }
  }

  for (const secret of secrets) {
    const digestHex = createHmac('sha256', secret).update(payload).digest('hex')
    const digestBase64 = Buffer.from(digestHex, 'hex').toString('base64')

    if (safeCompare(received.toLowerCase(), digestHex) || safeCompare(received, digestBase64)) {
      return {
        ok: true,
        reason: null
      }
    }
  }

  return {
    ok: false,
    reason: 'Callback signature verification failed.'
  }
}

export const getMpesaBaseUrl = environment => {
  return environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke'
}

export const normalizeKenyanPhone = input => {
  const digits = String(input || '').replace(/[^\d]/g, '')

  if (!digits) {
    return ''
  }

  if (digits.startsWith('254') && digits.length === 12) {
    return digits
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`
  }

  if (digits.length === 9) {
    return `254${digits}`
  }

  return ''
}

const formatTimestamp = date => {
  const formatter = new Intl.DateTimeFormat('en-KE', {
    timeZone: toString(process.env.MPESA_TIMEZONE) || DEFAULT_MPESA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]))

  return `${values.year || ''}${values.month || ''}${values.day || ''}${values.hour || ''}${values.minute || ''}${values.second || ''}`
}

const describeFetchFailure = error => {
  const primary = toString(error?.message)
  const causeCode = toString(error?.cause?.code)
  const causeMessage = toString(error?.cause?.message)

  return [primary, causeCode, causeMessage].filter(Boolean).join(' | ') || 'fetch failed'
}

export const parseMpesaTransactionDate = raw => {
  const value = String(raw || '').trim()

  if (!/^\d{14}$/.test(value)) {
    return null
  }

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  const hour = Number(value.slice(8, 10))
  const minute = Number(value.slice(10, 12))
  const second = Number(value.slice(12, 14))

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

export const requestMpesaAccessToken = async config => {
  const baseUrl = getMpesaBaseUrl(config.environment)
  const credentials = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64')
  let response

  debugLog('[M-Pesa OAuth] Requesting token from:', `${baseUrl}/oauth/v1/generate`)
  debugLog('[M-Pesa OAuth] Environment:', config.environment)

  try {
    response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${credentials}`
      }
    })
  } catch (error) {
    debugLog('[M-Pesa OAuth] Network error:', error.message)
    throw new Error(`Unable to reach M-Pesa OAuth endpoint. ${describeFetchFailure(error)}`)
  }

  const payload = await response.json().catch(() => ({}))

  debugLog('[M-Pesa OAuth] Response status:', response.status)

  if (!response.ok || !payload?.access_token) {
    const message = payload?.errorMessage || payload?.error_description || 'Unable to get M-Pesa access token.'
    const errorCode = payload?.errorCode

    debugLog('[M-Pesa OAuth] Token request failed:', { message, errorCode, status: response.status })

    // Provide more specific error messages based on common Daraja errors
    if (errorCode === '401001' || message.toLowerCase().includes('invalid')) {
      throw new Error(
        `M-Pesa authentication failed: Invalid credentials. Please check MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in your environment variables.`
      )
    }

    throw new Error(message)
  }

  return payload.access_token
}

export const initiateMpesaStkPush = async ({ config, phoneNumber, amount, accountReference, description }) => {
  const baseUrl = getMpesaBaseUrl(config.environment)

  debugLog('[M-Pesa STK] Initiating STK push:', {
    environment: config.environment,
    baseUrl,
    shortcode: config.shortcode,
    phoneNumber: maskPhone(phoneNumber),
    amount,
    accountReference
  })

  const accessToken = await requestMpesaAccessToken(config)
  const timestamp = formatTimestamp(new Date())
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64')

  const requestBody = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: config.transactionType,
    Amount: Math.max(1, Math.round(Number(amount))),
    PartyA: phoneNumber,
    PartyB: config.shortcode,
    PhoneNumber: phoneNumber,
    CallBackURL: config.callbackUrl,
    AccountReference: accountReference || 'Mambaproperties',
    TransactionDesc: description || 'Rent payment'
  }

  debugLog('[M-Pesa STK] Sending request to:', `${baseUrl}/mpesa/stkpush/v1/processrequest`)
  debugLog('[M-Pesa STK] Request summary:', {
    BusinessShortCode: requestBody.BusinessShortCode,
    Timestamp: requestBody.Timestamp,
    TransactionType: requestBody.TransactionType,
    Amount: requestBody.Amount,
    PartyA: maskPhone(requestBody.PartyA),
    PartyB: requestBody.PartyB,
    PhoneNumber: maskPhone(requestBody.PhoneNumber),
    CallBackURL: requestBody.CallBackURL,
    AccountReference: requestBody.AccountReference,
    TransactionDesc: requestBody.TransactionDesc
  })

  let response

  try {
    response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })
  } catch (error) {
    debugLog('[M-Pesa STK] Network error:', error.message)
    throw new Error(`Unable to reach M-Pesa STK endpoint. ${describeFetchFailure(error)}`)
  }

  const payload = await response.json().catch(() => ({}))

  debugLog('[M-Pesa STK] Response status:', response.status)
  debugLog('[M-Pesa STK] Response payload:', {
    ResponseCode: payload?.ResponseCode,
    ResponseDescription: payload?.ResponseDescription,
    MerchantRequestID: payload?.MerchantRequestID || null,
    CheckoutRequestID: payload?.CheckoutRequestID || null,
    errorCode: payload?.errorCode || null,
    errorMessage: payload?.errorMessage || null
  })

  if (!response.ok || payload?.ResponseCode !== '0') {
    const message = payload?.errorMessage || payload?.ResponseDescription || 'M-Pesa STK push request failed.'
    const responseCode = payload?.ResponseCode

    debugLog('[M-Pesa STK] Request failed:', {
      message,
      responseCode,
      errorCode: payload?.errorCode || null
    })

    // Provide more specific error messages based on common Daraja error codes
    if (responseCode === '1') {
      throw new Error('M-Pesa STK failed: Insufficient funds in the account.')
    }

    if (responseCode === '2') {
      throw new Error('M-Pesa STK failed: Less than minimum transaction amount.')
    }

    if (responseCode === '3') {
      throw new Error('M-Pesa STK failed: Rejected by M-Pesa.')
    }

    if (responseCode === '4') {
      throw new Error('M-Pesa STK failed: Duplicate transaction detected.')
    }

    if (payload?.errorCode === '500.001.1001' || message.toLowerCase().includes('wrong credentials')) {
      throw new Error('M-Pesa STK failed: Wrong shortcode/passkey combination. Check MPESA_SHORTCODE and MPESA_PASSKEY.')
    }

    throw new Error(message)
  }

  return payload
}
