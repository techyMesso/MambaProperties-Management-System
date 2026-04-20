const ALERT_TIMEOUT_MS = 2500
const DEFAULT_MIN_INTERVAL_MS = 5 * 60 * 1000
const LAST_ALERT_TS_KEY = '__mambaLastOpsAlertAt'

const toText = value => String(value || '').trim()

const toNumber = (value, fallback) => {
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const readWebhookUrl = () => toText(process.env.ALERT_WEBHOOK_URL)
const readMinIntervalMs = () => toNumber(process.env.ALERT_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS)

const getGlobalLastAlertTs = () => {
  const fromGlobal = Number(globalThis[LAST_ALERT_TS_KEY] || 0)

  return Number.isFinite(fromGlobal) ? fromGlobal : 0
}

const setGlobalLastAlertTs = value => {
  globalThis[LAST_ALERT_TS_KEY] = value
}

export const getOpsAlertConfig = () => {
  const webhookUrl = readWebhookUrl()
  const minIntervalMs = readMinIntervalMs()

  return {
    enabled: Boolean(webhookUrl),
    provider: 'webhook',
    minIntervalMs
  }
}

export const dispatchOpsAlert = async ({ title, message, severity = 'critical', context = {} }) => {
  const webhookUrl = readWebhookUrl()

  if (!webhookUrl) {
    return {
      ok: false,
      delivered: false,
      skipped: true,
      reason: 'webhook_not_configured'
    }
  }

  const minIntervalMs = readMinIntervalMs()
  const now = Date.now()
  const lastSentAt = getGlobalLastAlertTs()

  if (lastSentAt && now - lastSentAt < minIntervalMs) {
    return {
      ok: false,
      delivered: false,
      skipped: true,
      reason: 'cooldown_active'
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS)

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service: 'mambaproperties-web',
        title: toText(title) || 'Ops Alert',
        message: toText(message) || 'Monitoring alert triggered',
        severity,
        timestamp: new Date(now).toISOString(),
        context
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      return {
        ok: false,
        delivered: false,
        skipped: false,
        reason: `webhook_http_${response.status}`
      }
    }

    setGlobalLastAlertTs(now)

    return {
      ok: true,
      delivered: true,
      skipped: false
    }
  } catch (error) {
    return {
      ok: false,
      delivered: false,
      skipped: false,
      reason: error instanceof Error ? error.message : 'webhook_send_failed'
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
