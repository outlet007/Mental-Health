const fs = require('fs')
const path = require('path')

const settingsFile = path.join(__dirname, '../../data/survey-email-settings.json')

const DEFAULT_SETTINGS = {
  recipientMode: 'client',
  customEmail: '',
  deliveryMode: 'test',
  gmailUser: '',
  gmailAppPassword: '',
  fromName: 'MindCare Docker',
  fromEmail: 'no-reply@mindcare.local',
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function cleanSettings(data = {}) {
  const deliveryMode = data.deliveryMode === 'gmail' ? 'gmail' : 'test'
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    recipientMode: data.recipientMode === 'custom' ? 'custom' : 'client',
    customEmail: String(data.customEmail || '').trim(),
    deliveryMode,
    gmailUser: String(data.gmailUser || '').trim(),
    gmailAppPassword: String(data.gmailAppPassword || '').trim(),
    fromName: String(data.fromName || DEFAULT_SETTINGS.fromName).trim(),
    fromEmail: String(data.fromEmail || '').trim() || (deliveryMode === 'gmail' ? String(data.gmailUser || '').trim() : DEFAULT_SETTINGS.fromEmail),
  }
}

function readSurveyEmailSettings() {
  if (!fs.existsSync(settingsFile)) return { ...DEFAULT_SETTINGS }
  try {
    return cleanSettings(JSON.parse(fs.readFileSync(settingsFile, 'utf8')))
  } catch (error) {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSurveyEmailSettings(settings) {
  const data = {
    ...cleanSettings(settings),
    updatedAt: new Date().toISOString(),
  }
  fs.writeFileSync(settingsFile, JSON.stringify(data, null, 2))
  return data
}

function resolveSurveyEmailRecipient(client, settings = readSurveyEmailSettings()) {
  const customEmail = String(settings.customEmail || '').trim()
  if (settings.recipientMode === 'custom' && isEmail(customEmail)) {
    return { ...client, email: customEmail }
  }
  return { ...client, email: client.email || '' }
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
  readSurveyEmailSettings,
  writeSurveyEmailSettings,
  resolveSurveyEmailRecipient,
  getEmailDeliveryConfig,
}

