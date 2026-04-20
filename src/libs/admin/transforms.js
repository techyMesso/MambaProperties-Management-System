/**
 * Shared transformation utilities for admin API routes
 * @module admin/transforms
 */

/**
 * Converts a value to a trimmed string
 * @param {unknown} value - The value to convert
 * @returns {string} - Trimmed string representation
 */
export const toText = value => String(value || '').trim()

/**
 * Normalizes a status value to lowercase
 * @param {unknown} value - The value to normalize
 * @returns {string} - Lowercase trimmed string
 */
export const normalizeStatus = value => toText(value).toLowerCase()

/**
 * Normalizes a decision value to lowercase
 * @param {unknown} value - The value to normalize
 * @returns {string} - Lowercase trimmed string
 */
export const normalizeDecision = value => toText(value).toLowerCase()

/**
 * Attempts to write an audit log entry
 * @param {Object} params - Parameters object
 * @param {Object} params.supabase - Supabase client instance
 * @param {Object} params.user - Current admin user object
 * @param {string} params.entity - Entity being audited
 * @param {string} params.action - Action performed (create, update, delete, etc.)
 * @param {string} params.status - Status of the action
 * @param {string} [params.note] - Optional note for the audit log
 * @returns {Promise<void>}
 */
export const tryAuditLog = async ({ supabase, user, entity, action, status, note }) => {
  try {
    await supabase.from('admin_audit_logs').insert({
      owner_id: user.id,
      actor_id: user.id,
      entity,
      action,
      owner_name: toText(user.email || 'Admin User'),
      status,
      metadata: {
        note: note || null
      }
    })
  } catch {
    // Audit write should not block the primary mutation.
  }
}
