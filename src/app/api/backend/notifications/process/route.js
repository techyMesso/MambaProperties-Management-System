import { API_RESPONSES } from '@/libs/api/apiResponses'
import { sendNotification } from '@/libs/notifications'
import { createAdminClient } from '@/libs/supabase/admin'

const toText = value => String(value || '').trim()

const readNotificationsKey = () => toText(process.env.NOTIFICATIONS_CRON_KEY)

const getPresentedKey = request => {
  const authHeader = toText(request.headers.get('authorization'))

  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return toText(authHeader.slice(7))
  }

  return toText(request.headers.get('x-notifications-key'))
}

const isAuthorizedProcessor = request => {
  const expected = readNotificationsKey()
  const provided = getPresentedKey(request)

  return Boolean(expected && provided && expected === provided)
}

const escapeHtml = value =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const normalizeChannel = value => toText(value).toLowerCase()

const resolveRecipient = ({ channel, recipientPhone, recipientEmail }) => {
  if (channel === 'email') {
    return recipientEmail
  }

  return recipientPhone
}

export async function POST(request) {
  const notificationsKey = readNotificationsKey()

  if (!notificationsKey) {
    return API_RESPONSES.unavailable(request, 'Notifications processor is not configured. Set NOTIFICATIONS_CRON_KEY.')
  }

  if (!isAuthorizedProcessor(request)) {
    return API_RESPONSES.forbidden(request, 'Invalid notifications key.')
  }

  const supabase = createAdminClient()

  if (!supabase) {
    return API_RESPONSES.unavailable(request, 'Supabase is not configured.')
  }

  let body

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const batchSizeRaw = Number(body?.batchSize || 25)
  const batchSize = Number.isFinite(batchSizeRaw) ? Math.min(Math.max(Math.floor(batchSizeRaw), 1), 100) : 25

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, channel, recipient_phone, recipient_email, subject, message, attempts')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (error) {
    return API_RESPONSES.badRequest(request, error.message)
  }

  if (!notifications?.length) {
    return API_RESPONSES.ok(request, {
      processed: 0,
      sent: 0,
      failed: 0
    })
  }

  const now = new Date().toISOString()

  const attemptsById = new Map(notifications.map(entry => [entry.id, entry.attempts || 0]))

  const results = await Promise.all(
    notifications.map(async entry => {
      const channel = normalizeChannel(entry.channel)

      const to = resolveRecipient({
        channel,
        recipientPhone: toText(entry.recipient_phone),
        recipientEmail: toText(entry.recipient_email)
      })

      if (!to) {
        return {
          id: entry.id,
          success: false,
          error: `Missing recipient ${channel === 'email' ? 'email' : 'phone'}`
        }
      }

      const message = toText(entry.message)
      const subject = toText(entry.subject) || 'Notification'
      const html = channel === 'email' ? `<p>${escapeHtml(message)}</p>` : undefined

      try {
        const response = await sendNotification({ channel, to, subject, message, html, text: message })

        if (response?.success) {
          return { id: entry.id, success: true }
        }

        return { id: entry.id, success: false, error: response?.error || 'Notification failed' }
      } catch (error) {
        return { id: entry.id, success: false, error: error?.message || 'Notification failed' }
      }
    })
  )

  const updates = await Promise.all(
    results.map(result =>
      supabase
        .from('notifications')
        .update({
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? now : null,
          error: result.success ? null : toText(result.error),
          attempts: (attemptsById.get(result.id) || 0) + 1,
          last_attempted_at: now
        })
        .eq('id', result.id)
    )
  )

  const updateError = updates.find(update => update.error)?.error

  if (updateError) {
    return API_RESPONSES.badRequest(request, updateError.message)
  }

  const sent = results.filter(result => result.success).length
  const failed = results.length - sent

  return API_RESPONSES.ok(request, {
    processed: results.length,
    sent,
    failed
  })
}
