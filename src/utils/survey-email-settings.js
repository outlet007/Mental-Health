const path = require('path')
const { readJSON, writeJSON } = require('./json-store')

const settingsFile = path.join(__dirname, '../../data/survey-email-settings.json')

const EMAIL_TYPE_DEFAULTS = {
  appointmentClient: { enabled: true, recipientMode: 'default', customEmail: '' },
  appointmentCounselor: { enabled: true, recipientMode: 'default', customEmail: '' },
  counselorReassigned: { enabled: true, recipientMode: 'default', customEmail: '' },
  survey: { enabled: true, recipientMode: 'default', customEmail: '' },
  reminder: { enabled: false, recipientMode: 'default', customEmail: '', hoursBefore: 24 },
}

const DEFAULT_SETTINGS = {
  deliveryMode: 'test',
  gmailUser: '',
  gmailAppPassword: '',
  fromName: 'MindCare Docker',
  fromEmail: 'no-reply@mindcare.local',
  emailTypes: EMAIL_TYPE_DEFAULTS,
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function cleanHoursBefore(value, fallback) {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return fallback
  return Math.min(168, Math.max(1, n))
}

// `input` is undefined when the stored settings file predates this type (or
// predates the whole emailTypes map) — fall back to that type's own default
// rather than defaulting every field to false/empty.
function cleanEmailType(input, fallback) {
  if (input === undefined) return { ...fallback }
  const clean = {
    enabled: input.enabled === true || input.enabled === 'on' || input.enabled === 'true',
    recipientMode: input.recipientMode === 'custom' ? 'custom' : 'default',
    customEmail: String(input.customEmail || '').trim(),
  }
  if ('hoursBefore' in fallback) clean.hoursBefore = cleanHoursBefore(input.hoursBefore, fallback.hoursBefore)
  return clean
}

function cleanEmailTypes(data = {}) {
  const clean = {}
  for (const type of Object.keys(EMAIL_TYPE_DEFAULTS)) {
    clean[type] = cleanEmailType(data[type], EMAIL_TYPE_DEFAULTS[type])
  }
  return clean
}

function cleanSettings(data = {}) {
  const deliveryMode = data.deliveryMode === 'gmail' ? 'gmail' : 'test'
  return {
    deliveryMode,
    gmailUser: String(data.gmailUser || '').trim(),
    gmailAppPassword: String(data.gmailAppPassword || '').trim(),
    fromName: String(data.fromName || DEFAULT_SETTINGS.fromName).trim(),
    fromEmail: String(data.fromEmail || '').trim() || (deliveryMode === 'gmail' ? String(data.gmailUser || '').trim() : DEFAULT_SETTINGS.fromEmail),
    emailTypes: cleanEmailTypes(data.emailTypes || {}),
  }
}

function readSurveyEmailSettings() {
  const stored = readJSON(settingsFile, null)
  if (!stored) return { ...DEFAULT_SETTINGS, emailTypes: cleanEmailTypes({}) }
  return cleanSettings(stored)
}

function writeSurveyEmailSettings(settings) {
  const data = {
    ...cleanSettings(settings),
    updatedAt: new Date().toISOString(),
  }
  writeJSON(settingsFile, data)
  return data
}

function writeEmailType(type, values) {
  if (!(type in EMAIL_TYPE_DEFAULTS)) throw new Error(`Unknown email type: ${type}`)
  const current = readSurveyEmailSettings()
  current.emailTypes[type] = cleanEmailType(values, EMAIL_TYPE_DEFAULTS[type])
  return writeSurveyEmailSettings(current)
}

// Swaps in the custom override email for a type when configured, otherwise
// leaves the person's own email untouched.
function resolveEmailRecipient(type, person, settings = readSurveyEmailSettings()) {
  const config = settings.emailTypes[type] || EMAIL_TYPE_DEFAULTS[type]
  const customEmail = String(config.customEmail || '').trim()
  if (config.recipientMode === 'custom' && isEmail(customEmail)) {
    return { ...person, email: customEmail }
  }
  return { ...person, email: person.email || '' }
}

function isEmailTypeEnabled(type, settings = readSurveyEmailSettings()) {
  const config = settings.emailTypes[type] || EMAIL_TYPE_DEFAULTS[type]
  return config.enabled === true
}

// Bundles the enabled/recipient-override/delivery decisions each call site
// needs so appointments.js, clients.js, and contacts.js don't each re-derive
// the same 3 settings lookups by hand.
function resolveAppointmentEmailOptions(client, counselor, settings = readSurveyEmailSettings()) {
  return {
    client: resolveEmailRecipient('appointmentClient', client, settings),
    counselor: resolveEmailRecipient('appointmentCounselor', counselor, settings),
    skipClient: !isEmailTypeEnabled('appointmentClient', settings),
    skipCounselor: !isEmailTypeEnabled('appointmentCounselor', settings),
    deliveryConfig: getEmailDeliveryConfig(settings),
  }
}

function resolveReassignedEmailOptions(counselor, settings = readSurveyEmailSettings()) {
  return {
    counselor: resolveEmailRecipient('counselorReassigned', counselor, settings),
    skip: !isEmailTypeEnabled('counselorReassigned', settings),
    deliveryConfig: getEmailDeliveryConfig(settings),
  }
}

function resolveSurveyEmailOptions(client, settings = readSurveyEmailSettings()) {
  return {
    client: resolveEmailRecipient('survey', client, settings),
    skip: !isEmailTypeEnabled('survey', settings),
    deliveryConfig: getEmailDeliveryConfig(settings),
  }
}

function getEmailDeliveryConfig(settings = readSurveyEmailSettings()) {
  const clean = cleanSettings(settings)
  if (clean.deliveryMode === 'gmail') {
    return {
      mode: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: true,
      user: clean.gmailUser,
      pass: clean.gmailAppPassword,
      fromName: clean.fromName || 'MindCare',
      fromEmail: clean.fromEmail || clean.gmailUser,
    }
  }

  return {
    mode: 'test',
    host: 'mailpit',
    port: 1025,
    secure: false,
    auth: false,
    fromName: clean.fromName || DEFAULT_SETTINGS.fromName,
    fromEmail: clean.fromEmail || DEFAULT_SETTINGS.fromEmail,
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  EMAIL_TYPE_DEFAULTS,
  readSurveyEmailSettings,
  writeSurveyEmailSettings,
  writeEmailType,
  resolveEmailRecipient,
  isEmailTypeEnabled,
  resolveAppointmentEmailOptions,
  resolveReassignedEmailOptions,
  resolveSurveyEmailOptions,
  getEmailDeliveryConfig,
}
