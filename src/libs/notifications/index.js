/**
 * Notification Service
 * Unified interface for SMS, WhatsApp, and Email notifications
 */

// SMS Provider - Africa's Talking
const sendSMS = async ({ to, message }) => {
  const apiKey = process.env.AFRICASTALKING_API_KEY
  const username = process.env.AFRICASTALKING_USERNAME || 'sandbox'
  const senderId = process.env.AFRICASTALKING_SENDER_ID || 'MAMBA'

  if (!apiKey) {
    console.warn("[SMS] Africa's Talking API key not configured")

    return { success: false, error: 'SMS provider not configured' }
  }

  try {
    const response = await fetch(`https://api.africastalking.com/version1/messaging`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString('base64')}`
      },
      body: new URLSearchParams({
        username,
        to,
        message,
        from: senderId
      })
    })

    const data = await response.json()

    if (data.ACK === 'Success') {
      return { success: true, data }
    }

    return { success: false, error: data.error }
  } catch (error) {
    console.error('[SMS] Failed to send:', error.message)

    return { success: false, error: error.message }
  }
}

// WhatsApp Provider - Twilio
const sendWhatsApp = async ({ to, message }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'

  if (!accountSid || !authToken) {
    console.warn('[WhatsApp] Twilio credentials not configured')

    return { success: false, error: 'WhatsApp provider not configured' }
  }

  try {
    // Format phone number for WhatsApp
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
    const fromFormatted = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`
      },
      body: new URLSearchParams({
        From: fromFormatted,
        To: toFormatted,
        Body: message
      })
    })

    const data = await response.json()

    if (response.ok) {
      return { success: true, data }
    }

    return { success: false, error: data.message }
  } catch (error) {
    console.error('[WhatsApp] Failed to send:', error.message)

    return { success: false, error: error.message }
  }
}

// Email Provider - SendGrid
const sendEmail = async ({ to, subject, html, text }) => {
  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@mambaproperties.com'
  const fromName = process.env.SENDGRID_FROM_NAME || 'Mamba Properties'

  if (!apiKey) {
    console.warn('[Email] SendGrid API key not configured')

    return { success: false, error: 'Email provider not configured' }
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [
          { type: 'text/plain', value: text || html?.replace(/<[^>]*>/g, '') },
          { type: 'text/html', value: html }
        ].filter(c => c.value)
      })
    })

    if (response.ok || response.status === 202) {
      return { success: true }
    }

    const data = await response.json()

    return { success: false, error: data.errors?.[0]?.message || 'Failed to send email' }
  } catch (error) {
    console.error('[Email] Failed to send:', error.message)

    return { success: false, error: error.message }
  }
}

// Email Provider - Postmark (alternative)
const sendEmailPostmark = async ({ to, subject, html, text }) => {
  const serverToken = process.env.POSTMARK_SERVER_TOKEN
  const fromEmail = process.env.POSTMARK_FROM_EMAIL || 'noreply@mambaproperties.com'
  const fromName = process.env.POSTMARK_FROM_NAME || 'Mamba Properties'

  if (!serverToken) {
    console.warn('[Email] Postmark server token not configured')

    return { success: false, error: 'Email provider not configured' }
  }

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Postmark-Server-Token': serverToken
      },
      body: JSON.stringify({
        From: `${fromName} <${fromEmail}>`,
        To: to,
        Subject: subject,
        HtmlBody: html,
        TextBody: text || html?.replace(/<[^>]*>/g, '')
      })
    })

    const data = await response.json()

    if (response.ok && data.ErrorCode === 0) {
      return { success: true, data }
    }

    return { success: false, error: data.Message || 'Failed to send email' }
  } catch (error) {
    console.error('[Email] Failed to send:', error.message)

    return { success: false, error: error.message }
  }
}

// Unified notification function
export const sendNotification = async ({ channel, to, subject, message, html, text }) => {
  switch (channel.toLowerCase()) {
    case 'sms':
      return sendSMS({ to, message })

    case 'whatsapp':
      return sendWhatsApp({ to, message })

    case 'email':
      // Try SendGrid first, fall back to Postmark
      if (process.env.SENDGRID_API_KEY) {
        return sendEmail({ to, subject, html, text })
      }

      if (process.env.POSTMARK_SERVER_TOKEN) {
        return sendEmailPostmark({ to, subject, html, text })
      }

      return { success: false, error: 'No email provider configured' }

    default:
      return { success: false, error: `Unknown channel: ${channel}` }
  }
}

// Send to multiple channels
export const sendMultiChannelNotification = async ({ channels, to, subject, message, html, text }) => {
  const results = await Promise.allSettled(
    channels.map(channel => sendNotification({ channel, to, subject, message, html, text }))
  )

  return {
    sent: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
    failed: results.filter(r => r.status === 'rejected' || !r.value.success).length,
    details: results.map((r, i) => ({
      channel: channels[i],
      status: r.status === 'fulfilled' ? (r.value.success ? 'sent' : 'failed') : 'error',
      error: r.status === 'rejected' ? r.reason?.message : r.value?.error
    }))
  }
}

export default {
  sendNotification,
  sendMultiChannelNotification,
  sendSMS,
  sendWhatsApp,
  sendEmail,
  sendEmailPostmark
}
