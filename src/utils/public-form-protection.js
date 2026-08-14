const crypto = require('crypto')

const FORM_TOKEN_MIN_AGE_MS = 1500
const FORM_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const fallbackSecret = crypto.randomBytes(32).toString('hex')

function getFormSecret() {
  return process.env.ANTI_SPAM_SECRET || process.env.SESSION_SECRET || fallbackSecret
}

function signTimestamp(timestamp) {
  return crypto.createHmac('sha256', getFormSecret()).update(String(timestamp)).digest('hex')
}

function createFormToken(now = Date.now()) {
  return `${now}.${signTimestamp(now)}`
}

function verifyFormToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 128) return false
  const [timestampText, signature, extra] = token.split('.')
  if (extra || !/^\d{13}$/.test(timestampText) || !/^[a-f0-9]{64}$/.test(signature || '')) return false

  const expected = signTimestamp(timestampText)
  const suppliedBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return false

  const age = now - Number(timestampText)
  return age >= FORM_TOKEN_MIN_AGE_MS && age <= FORM_TOKEN_MAX_AGE_MS
}

function isHoneypotClear(value) {
  return typeof value !== 'string' || value.trim() === ''
}

function getTurnstileConfig() {
  const siteKey = (process.env.TURNSTILE_SITE_KEY || '').trim()
  const secretKey = (process.env.TURNSTILE_SECRET_KEY || '').trim()
  return { siteKey, secretKey, enabled: Boolean(siteKey && secretKey) }
}

async function verifyTurnstile({ token, remoteIp, action }) {
  const config = getTurnstileConfig()
  if (!config.enabled) return true
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048) return false

  const body = new URLSearchParams({ secret: config.secretKey, response: token })
  if (remoteIp) body.set('remoteip', remoteIp)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    })
    if (!response.ok) return false
    const result = await response.json()
    if (!result.success) return false
    if (action && result.action !== action) return false
    const allowedHostnames = (process.env.TURNSTILE_HOSTNAME || '')
      .split(',')
      .map(hostname => hostname.trim().toLowerCase())
      .filter(Boolean)
    const verifiedHostname = String(result.hostname || '').trim().toLowerCase()
    if (allowedHostnames.length && !allowedHostnames.includes(verifiedHostname)) return false
    return true
  } catch (_) {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = {
  FORM_TOKEN_MIN_AGE_MS,
  FORM_TOKEN_MAX_AGE_MS,
  createFormToken,
  verifyFormToken,
  isHoneypotClear,
  getTurnstileConfig,
  verifyTurnstile,
}
