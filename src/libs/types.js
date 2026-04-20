/**
 * Common type definitions for MambaProperties
 * @module types
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} [role]
 */

/**
 * @typedef {Object} SupabaseClient
 * @property {Object} from
 * @property {Object} auth
 */

/**
 * @typedef {Object} APIResponse
 * @property {boolean} success
 * @property {unknown} [data]
 * @property {string} [error]
 */

/**
 * @typedef {Object} AuditLogParams
 * @property {Object} supabase - Supabase client instance
 * @property {Object} user - Current admin user object
 * @property {string} entity - Entity being audited
 * @property {string} action - Action performed (create, update, delete, etc.)
 * @property {string} status - Status of the action
 * @property {string} [note] - Optional note for the audit log
 */

/**
 * @typedef {Object} AdminUser
 * @property {string} id
 * @property {string} email
 * @property {string} role
 * @property {string} [full_name]
 */

/**
 * @typedef {Object} Property
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} [address]
 * @property {string} [status]
 */

/**
 * @typedef {Object} Unit
 * @property {string} id
 * @property {string} property_id
 * @property {string} unit_number
 * @property {string} [status]
 * @property {number} [rent_amount]
 */

/**
 * @typedef {Object} Tenant
 * @property {string} id
 * @property {string} user_id
 * @property {string} [full_name]
 * @property {string} [phone_number]
 * @property {string} [email]
 */

/**
 * @typedef {Object} Subscription
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} property_id
 * @property {string} unit_id
 * @property {string} [status]
 * @property {string} [start_date]
 * @property {string} [end_date]
 */

/**
 * @typedef {Object} Fee
 * @property {string} id
 * @property {string} property_id
 * @property {string} name
 * @property {number} amount
 * @property {string} [description]
 * @property {string} [frequency]
 */

/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} subscription_id
 * @property {number} amount
 * @property {string} [status]
 * @property {string} [payment_method]
 * @property {string} [transaction_id]
 */

export {}
