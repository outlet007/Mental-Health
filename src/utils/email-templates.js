const fs = require('fs')
const path = require('path')

const templatesFile = path.join(__dirname, '../../data/email-templates.json')

const EMAIL_TYPES = [
  { id: 'appointmentClient', label: 'ยืนยันนัดหมาย (ถึงผู้รับบริการ)' },
  { id: 'appointmentCounselor', label: 'แจ้งนัดหมายใหม่ (ถึงนักจิตวิทยา)' },
  { id: 'counselorReassigned', label: 'แจ้งนำนัดออกจากคิว (ถึงนักจิตวิทยาเดิม)' },
  { id: 'survey', label: 'ประเมินความพึงพอใจ (ถึงผู้รับบริการ)' },
  { id: 'reminder', label: 'แจ้งเตือนนัดหมายล่วงหน้า (ถึงผู้รับบริการ)' },
]

const EMAIL_TYPE_IDS = EMAIL_TYPES.map(t => t.id)

const PLACEHOLDERS = ['clientName', 'counselorName', 'date', 'time', 'duration', 'appointmentId']

// These 2 types tell the client when/how to show up, so their closing line
// needs separate text for online vs onsite appointments ("join" vs "arrive").
// The other types (counselor notice, reassignment, survey) read the same
// either way, so their `closing` stays a plain {th, en} string.
const TYPES_WITH_CLOSING_VARIANTS = ['appointmentClient', 'reminder']

function hasClosingVariants(type) {
  return TYPES_WITH_CLOSING_VARIANTS.includes(type)
}

// Matches the text currently hardcoded in mailer.js — used whenever an admin
// hasn't overridden a field, so turning this feature on changes nothing by default.
const DEFAULT_TEMPLATES = {
  appointmentClient: {
    title: { th: 'ยืนยันนัดหมาย', en: 'ยืนยันนัดหมาย' },
    greeting: {
      th: 'สวัสดี <strong>{{clientName}}</strong><br>ยืนยันการนัดหมายของคุณเรียบร้อยแล้ว',
      en: 'Hello <strong>{{clientName}}</strong><br>Your appointment has been confirmed.',
    },
    closing: {
      th: { online: 'โปรดเข้าร่วมก่อนเวลา 5-10 นาที', onsite: 'โปรดมาถึงก่อนเวลา 5-10 นาที' },
      en: { online: 'Please join 5-10 minutes before the appointment time.', onsite: 'Please arrive 5-10 minutes before the appointment time.' },
    },
  },
  appointmentCounselor: {
    title: { th: 'นัดหมายใหม่', en: 'นัดหมายใหม่' },
    greeting: {
      th: 'สวัสดี <strong>{{counselorName}}</strong><br>คุณมีนัดหมายใหม่จาก MindCare',
      en: 'Hello <strong>{{counselorName}}</strong><br>You have a new appointment from MindCare.',
    },
    closing: {
      th: 'โปรดตรวจสอบรูปแบบการนัดหมายก่อนเวลา',
      en: 'Please check the appointment format before the session.',
    },
  },
  counselorReassigned: {
    title: { th: 'ยกเลิกนัดหมาย', en: 'ยกเลิกนัดหมาย' },
    greeting: {
      th: 'สวัสดี <strong>{{counselorName}}</strong><br>นัดหมายนี้ถูกเปลี่ยนไปเป็นนักจิตวิทยาท่านอื่นแล้ว กรุณานำนัดออกจากตารางเวลาของคุณ',
      en: 'Hello <strong>{{counselorName}}</strong><br>This appointment has been reassigned to another counselor. Please remove it from your schedule.',
    },
    closing: { th: '', en: '' },
  },
  survey: {
    title: { th: 'ประเมินความพึงพอใจ', en: 'ประเมินความพึงพอใจ' },
    greeting: {
      th: 'ความคิดเห็นของท่านช่วยให้เราพัฒนาบริการให้ดียิ่งขึ้น',
      en: 'Your feedback helps us improve our service.',
    },
    closing: {
      th: 'ทำแบบประเมินความพึงพอใจ',
      en: 'Please rate your satisfaction',
    },
  },
  reminder: {
    title: { th: 'แจ้งเตือนนัดหมายล่วงหน้า', en: 'แจ้งเตือนนัดหมายล่วงหน้า' },
    greeting: {
      th: 'สวัสดี <strong>{{clientName}}</strong><br>ใกล้ถึงกำหนดการนัดหมายของคุณแล้ว อย่าลืมนัดนะคะ/ครับ',
      en: "Hello <strong>{{clientName}}</strong><br>Your appointment is coming up soon. Please don't forget!",
    },
    closing: {
      th: { online: 'โปรดเข้าร่วมก่อนเวลา 5-10 นาที', onsite: 'โปรดมาถึงก่อนเวลา 5-10 นาที' },
      en: { online: 'Please join 5-10 minutes before the appointment time.', onsite: 'Please arrive 5-10 minutes before the appointment time.' },
    },
  },
}

function emptyClosingField(type) {
  return hasClosingVariants(type) ? { online: '', onsite: '' } : ''
}

function emptyTemplate(type) {
  return {
    title: { th: '', en: '' },
    greeting: { th: '', en: '' },
    closing: { th: emptyClosingField(type), en: emptyClosingField(type) },
  }
}

function cleanClosingField(value, type) {
  if (hasClosingVariants(type)) {
    const v = value || {}
    return { online: String(v.online || '').trim(), onsite: String(v.onsite || '').trim() }
  }
  return String(value || '').trim()
}

function cleanTemplate(type, data = {}) {
  const clean = emptyTemplate(type)
  for (const field of ['title', 'greeting']) {
    const value = data[field] || {}
    clean[field] = {
      th: String(value.th || '').trim(),
      en: String(value.en || '').trim(),
    }
  }
  const closingData = data.closing || {}
  clean.closing = {
    th: cleanClosingField(closingData.th, type),
    en: cleanClosingField(closingData.en, type),
  }
  return clean
}

// Overrides (may be partially filled) merged over defaults — any field left
// blank by the admin falls back to the built-in default text for that field.
function readEmailTemplates() {
  let stored = {}
  if (fs.existsSync(templatesFile)) {
    try { stored = JSON.parse(fs.readFileSync(templatesFile, 'utf8')) } catch (error) { stored = {} }
  }
  const result = {}
  for (const id of EMAIL_TYPE_IDS) {
    result[id] = cleanTemplate(id, stored[id])
  }
  return result
}

function writeEmailTemplate(type, template) {
  if (!EMAIL_TYPE_IDS.includes(type)) throw new Error(`Unknown email type: ${type}`)
  const all = readEmailTemplates()
  all[type] = cleanTemplate(type, template)
  fs.writeFileSync(templatesFile, JSON.stringify(all, null, 2))
  return all[type]
}

// Built-in defaults use <strong>/<br> for the rendered email; strip those
// before showing the default as a placeholder hint since admins type plain
// text (tags are only an optional effect they can add themselves).
function stripHtml(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripClosingField(value, type) {
  if (hasClosingVariants(type)) {
    return { online: stripHtml(value.online), onsite: stripHtml(value.onsite) }
  }
  return stripHtml(value)
}

function plainDefaultTemplate(type) {
  const d = DEFAULT_TEMPLATES[type]
  return {
    title: { th: stripHtml(d.title.th), en: stripHtml(d.title.en) },
    greeting: { th: stripHtml(d.greeting.th), en: stripHtml(d.greeting.en) },
    closing: { th: stripClosingField(d.closing.th, type), en: stripClosingField(d.closing.en, type) },
  }
}

function getPlainDefaultTemplates() {
  const result = {}
  for (const id of EMAIL_TYPE_IDS) result[id] = plainDefaultTemplate(id)
  return result
}

function applyPlaceholders(text, vars = {}) {
  if (!text) return text
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}

// Resolves the text actually used for one field: admin override (with
// placeholders substituted) if set, otherwise the built-in default.
function resolveField(override, defaultValue, vars) {
  const raw = String(override || '').trim()
  return applyPlaceholders(raw || defaultValue, vars)
}

// For variant types, `override`/`defaultValue` are {online, onsite} objects —
// pick the one matching this appointment's type (defaulting to "online" for
// any unrecognized/missing value) before resolving the text.
function resolveClosingField(override, defaultValue, vars, type, apptType) {
  if (!hasClosingVariants(type)) return resolveField(override, defaultValue, vars)
  const variant = apptType === 'onsite' ? 'onsite' : 'online'
  return resolveField(override && override[variant], defaultValue[variant], vars)
}

// `draftOverride` lets the preview endpoint render unsaved text the admin is
// still editing; when omitted, the saved override from disk is used instead.
// `apptType` ('online'/'onsite') only matters for types with closing variants.
function renderTemplateFields(type, lang, vars, draftOverride, apptType) {
  const override = draftOverride ? cleanTemplate(type, draftOverride) : (readEmailTemplates()[type] || emptyTemplate(type))
  const defaults = DEFAULT_TEMPLATES[type]
  return {
    title: resolveField(override.title[lang], defaults.title[lang], vars),
    greeting: resolveField(override.greeting[lang], defaults.greeting[lang], vars),
    closing: resolveClosingField(override.closing[lang], defaults.closing[lang], vars, type, apptType),
  }
}

module.exports = {
  EMAIL_TYPES,
  EMAIL_TYPE_IDS,
  PLACEHOLDERS,
  DEFAULT_TEMPLATES,
  TYPES_WITH_CLOSING_VARIANTS,
  hasClosingVariants,
  readEmailTemplates,
  writeEmailTemplate,
  applyPlaceholders,
  renderTemplateFields,
  stripHtml,
  getPlainDefaultTemplates,
}
