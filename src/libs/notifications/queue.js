import 'server-only'

import { safeQuery } from '@/libs/api/safeQuery'

const toText = value => String(value || '').trim()

const UNIQUE_CHANNELS = ['sms', 'whatsapp', 'email']

const normalizeChannels = value => {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map(item => toText(item).toLowerCase()).filter(channel => UNIQUE_CHANNELS.includes(channel)))]
}

const loadRecipientProfile = async ({ supabase, userId }) => {
  if (!supabase || !userId) {
    return { profile: null, email: '' }
  }

  const profileResult = await safeQuery(
    supabase.from('profiles').select('id,full_name,phone,email').eq('id', userId).maybeSingle()
  )

  let authEmail = ''

  try {
    const authResult = await supabase.auth.admin.getUserById(userId)

    authEmail = toText(authResult?.data?.user?.email)
  } catch {
    authEmail = ''
  }

  return {
    profile: profileResult.data || null,
    email: authEmail
  }
}

export const queueUserNotifications = async ({
  supabase,
  ownerId,
  recipientUserId,
  subject,
  message,
  channels = ['sms', 'email'],
  recipientName,
  recipientPhone,
  recipientEmail,
  period = null,
  invoiceId = null,
  tenantId = null
}) => {
  if (!supabase || !ownerId || !recipientUserId) {
    return { queued: 0, skipped: true }
  }

  const normalizedChannels = normalizeChannels(channels)

  if (!normalizedChannels.length) {
    return { queued: 0, skipped: true }
  }

  const recipient = await loadRecipientProfile({
    supabase,
    userId: recipientUserId
  })

  const finalName = toText(recipientName || recipient.profile?.full_name) || 'User'
  const finalPhone = toText(recipientPhone || recipient.profile?.phone)
  const finalEmail = toText(recipientEmail || recipient.profile?.email || recipient.email)

  const rows = normalizedChannels
    .map(channel => {
      if ((channel === 'sms' || channel === 'whatsapp') && !finalPhone) {
        return null
      }

      if (channel === 'email' && !finalEmail) {
        return null
      }

      return {
        owner_id: ownerId,
        invoice_id: invoiceId || null,
        tenant_id: tenantId || null,
        period: period || null,
        channel,
        recipient_name: finalName,
        recipient_phone: channel === 'email' ? null : finalPhone || null,
        recipient_email: channel === 'email' ? finalEmail || null : null,
        subject: toText(subject) || 'Notification',
        message: toText(message) || 'You have a new update from Mamba Properties.',
        status: 'queued'
      }
    })
    .filter(Boolean)

  if (!rows.length) {
    return { queued: 0, skipped: true }
  }

  const insertResult = await safeQuery(supabase.from('notifications').insert(rows).select('id'))

  if (insertResult.error) {
    return { queued: 0, error: insertResult.error }
  }

  return {
    queued: Array.isArray(insertResult.data) ? insertResult.data.length : rows.length,
    skipped: false
  }
}
