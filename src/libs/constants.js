/**
 * Centralized constants for MambaProperties
 * Eliminates magic numbers and scattered hardcoded values
 */

export const CONSTANTS = {
  // Storage configuration
  STORAGE: {
    SIGNED_URL_TTL_SECONDS: 60,
    SIGNED_URL_TTL_SECONDS_LONG: 60 * 60,
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
    MAX_UPLOAD_BYTES: 12 * 1024 * 1024, // 12MB (allows multipart/form-data overhead)
    // Storage SQL migrations still provision the legacy bucket name.
    BUCKET_NAME: 'rentpilot-documents'
  },

  // Subscription configuration
  SUBSCRIPTION: {
    DEFAULT_DURATION_DAYS: 30,
    GRACE_PERIOD_DAYS: 7,
    PRICING: {
      house_search: {
        name: 'House Search',
        amount: 299,
        duration_days: 30,
        features: ['Search & filter houses', 'Save favorites', 'Contact landlords']
      },
      market_premium: {
        name: 'Market Premium',
        amount: 999,
        duration_days: 30,
        features: ['All house search features', 'Market insights', 'Advanced analytics']
      }
    }
  },

  // Pagination defaults
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100
  },

  // Rate limiting
  RATE_LIMITS: {
    DEFAULT_LIMIT: 10,
    DEFAULT_WINDOW_MS: 60_000,
    SUBSCRIPTION_INITIATE: {
      limit: 5,
      windowMs: 60_000
    }
  },

  // API timeouts
  API: {
    TIMEOUT_MS: 30_000
  },

  // Feature flags
  FEATURES: {
    ENABLE_DEBUG_LOGGING: process.env.NODE_ENV !== 'production'
  },

  // Default currency
  CURRENCY: {
    DEFAULT: 'KES',
    SYMBOL: 'KSh'
  }
}

// Named exports for easy importing
export const { STORAGE, SUBSCRIPTION, PAGINATION, RATE_LIMITS, API, FEATURES, CURRENCY } = CONSTANTS

// Individual constant exports
export const {
  SIGNED_URL_TTL_SECONDS,
  SIGNED_URL_TTL_SECONDS_LONG,
  MAX_FILE_SIZE_BYTES,
  MAX_UPLOAD_BYTES,
  BUCKET_NAME
} = STORAGE

export const { DEFAULT_DURATION_DAYS, GRACE_PERIOD_DAYS, PRICING } = SUBSCRIPTION

export const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = PAGINATION

export const { DEFAULT_LIMIT, DEFAULT_WINDOW_MS, SUBSCRIPTION_INITIATE } = RATE_LIMITS

export const { TIMEOUT_MS } = API

export const { ENABLE_DEBUG_LOGGING } = FEATURES

export const { DEFAULT: DEFAULT_CURRENCY, SYMBOL: CURRENCY_SYMBOL } = CURRENCY
