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
const CLOSING_VARIANTS = ['online', 'phone', 'onsite']
const TYPES_WITH_ACCESS_DETAILS = ['appointmentClient', 'appointmentCounselor', 'reminder']
const ACCESS_DETAIL_FIELD_KEYS = [
  'onlineTitle',
  'onlineLinkLabel',
  'phoneTitle',
  'phoneCounselorPhoneLabel',
  'phoneClientNoticeLabel',
  'phoneClientNoticeText',
]

const DEFAULT_APPOINTMENT_ACCESS_DETAILS = {
  th: {
    onlineTitle: '\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e40\u0e02\u0e49\u0e32\u0e23\u0e48\u0e27\u0e21\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d\u0e04\u0e2d\u0e25',
    onlineLinkLabel: '\u0e25\u0e34\u0e07\u0e01\u0e4c',
    phoneTitle: '\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32\u0e17\u0e32\u0e07\u0e42\u0e17\u0e23\u0e28\u0e31\u0e1e\u0e17\u0e4c',
    phoneCounselorPhoneLabel: '\u0e40\u0e1a\u0e2d\u0e23\u0e4c\u0e42\u0e17\u0e23\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23',
    phoneClientNoticeLabel: '\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21',
    phoneClientNoticeText: '\u0e08\u0e34\u0e15\u0e41\u0e1e\u0e17\u0e22\u0e4c\u0e08\u0e30\u0e42\u0e17\u0e23\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d\u0e01\u0e25\u0e31\u0e1a\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32',
  },
  en: {
    onlineTitle: 'Video call link',
    onlineLinkLabel: 'Join link',
    phoneTitle: 'Phone counseling',
    phoneCounselorPhoneLabel: 'Client phone',
    phoneClientNoticeLabel: 'Notice',
    phoneClientNoticeText: 'The counselor will call you for counseling.',
  },
}

function hasClosingVariants(type) {
  return TYPES_WITH_CLOSING_VARIANTS.includes(type)
}

function hasAccessDetails(type) {
  return TYPES_WITH_ACCESS_DETAILS.includes(type)
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
      th: { online: 'โปรดเข้าร่วมก่อนเวลา 5-10 นาที', phone: '\u0e42\u0e1b\u0e23\u0e14\u0e23\u0e2d\u0e23\u0e31\u0e1a\u0e2a\u0e32\u0e22\u0e08\u0e32\u0e01\u0e19\u0e31\u0e01\u0e08\u0e34\u0e15\u0e27\u0e34\u0e17\u0e22\u0e32\u0e15\u0e32\u0e21\u0e40\u0e27\u0e25\u0e32\u0e19\u0e31\u0e14', onsite: 'โปรดมาถึงก่อนเวลา 5-10 นาที' },
      en: { online: 'Please join 5-10 minutes before the appointment time.', phone: 'Please keep your phone available at the appointment time.', onsite: 'Please arrive 5-10 minutes before the appointment time.' },
    },
    accessDetails: DEFAULT_APPOINTMENT_ACCESS_DETAILS,
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
    accessDetails: DEFAULT_APPOINTMENT_ACCESS_DETAILS,
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
      th: { online: 'โปรดเข้าร่วมก่อนเวลา 5-10 นาที', phone: '\u0e42\u0e1b\u0e23\u0e14\u0e23\u0e2d\u0e23\u0e31\u0e1a\u0e2a\u0e32\u0e22\u0e08\u0e32\u0e01\u0e19\u0e31\u0e01\u0e08\u0e34\u0e15\u0e27\u0e34\u0e17\u0e22\u0e32\u0e15\u0e32\u0e21\u0e40\u0e27\u0e25\u0e32\u0e19\u0e31\u0e14', onsite: 'โปรดมาถึงก่อนเวลา 5-10 นาที' },
      en: { online: 'Please join 5-10 minutes before the appointment time.', phone: 'Please keep your phone available at the appointment time.', onsite: 'Please arrive 5-10 minutes before the appointment time.' },
    },
    accessDetails: DEFAULT_APPOINTMENT_ACCESS_DETAILS,
  },
}

function emptyClosingField(type) {
  if (!hasClosingVariants(type)) return ''
  return Object.fromEntries(CLOSING_VARIANTS.map(variant => [variant, '']))
}

function emptyAccessDetailsField(type) {
  if (!hasAccessDetails(type)) return undefined
  return {
    th: Object.fromEntries(ACCESS_DETAIL_FIELD_KEYS.map(key => [key, ''])),
    en: Object.fromEntries(ACCESS_DETAIL_FIELD_KEYS.map(key => [key, ''])),
  }
}

function emptyTemplate(type) {
  const template = {
    title: { th: '', en: '' },
    greeting: { th: '', en: '' },
    closing: { th: emptyClosingField(type), en: emptyClosingField(type) },
  }
  if (hasAccessDetails(type)) template.accessDetails = emptyAccessDetailsField(type)
  return template
}

function cleanClosingField(value, type) {
  if (hasClosingVariants(type)) {
    const v = value || {}
    return Object.fromEntries(CLOSING_VARIANTS.map(variant => [variant, String(v[variant] || '').trim()]))
  }
  return String(value || '').trim()
}

function cleanAccessDetailsField(value, type) {
  if (!hasAccessDetails(type)) return undefined
  const v = value || {}
  const clean = emptyAccessDetailsField(type)
  for (const lang of ['th', 'en']) {
    for (const key of ACCESS_DETAIL_FIELD_KEYS) {
      clean[lang][key] = String((v[lang] && v[lang][key]) || '').trim()
    }
  }
  return clean
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
  if (hasAccessDetails(type)) clean.accessDetails = cleanAccessDetailsField(data.accessDetails, type)
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
    return Object.fromEntries(CLOSING_VARIANTS.map(variant => [variant, stripHtml(value[variant])]))
  }
  return stripHtml(value)
}

function stripAccessDetailsField(value, type) {
  if (!hasAccessDetails(type)) return undefined
  return {
    th: Object.fromEntries(ACCESS_DETAIL_FIELD_KEYS.map(key => [key, stripHtml(value.th[key])])),
    en: Object.fromEntries(ACCESS_DETAIL_FIELD_KEYS.map(key => [key, stripHtml(value.en[key])])),
  }
}

function plainDefaultTemplate(type) {
  const d = DEFAULT_TEMPLATES[type]
  const plain = {
    title: { th: stripHtml(d.title.th), en: stripHtml(d.title.en) },
    greeting: { th: stripHtml(d.greeting.th), en: stripHtml(d.greeting.en) },
    closing: { th: stripClosingField(d.closing.th, type), en: stripClosingField(d.closing.en, type) },
  }
  if (hasAccessDetails(type)) plain.accessDetails = stripAccessDetailsField(d.accessDetails, type)
  return plain
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
  const variant = CLOSING_VARIANTS.includes(apptType) ? apptType : 'online'
  return resolveField(override && override[variant], defaultValue[variant], vars)
}

function resolveAccessDetailsField(override, defaultValue, vars, type, lang) {
  if (!hasAccessDetails(type)) return undefined
  return Object.fromEntries(ACCESS_DETAIL_FIELD_KEYS.map(key => [
    key,
    resolveField(override && override[lang] && override[lang][key], defaultValue[lang][key], vars),
  ]))
}

// `draftOverride` lets the preview endpoint render unsaved text the admin is
// still editing; when omitted, the saved override from disk is used instead.
// `apptType` ('online'/'onsite') only matters for types with closing variants.
function renderTemplateFields(type, lang, vars, draftOverride, apptType) {
  const override = draftOverride ? cleanTemplate(type, draftOverride) : (readEmailTemplates()[type] || emptyTemplate(type))
  const defaults = DEFAULT_TEMPLATES[type]
  const fields = {
    title: resolveField(override.title[lang], defaults.title[lang], vars),
    greeting: resolveField(override.greeting[lang], defaults.greeting[lang], vars),
    closing: resolveClosingField(override.closing[lang], defaults.closing[lang], vars, type, apptType),
  }
  if (hasAccessDetails(type)) fields.accessDetails = resolveAccessDetailsField(override.accessDetails, defaults.accessDetails, vars, type, lang)
  return fields
}

module.exports = {
  EMAIL_TYPES,
  EMAIL_TYPE_IDS,
  PLACEHOLDERS,
  DEFAULT_TEMPLATES,
  TYPES_WITH_CLOSING_VARIANTS,
  CLOSING_VARIANTS,
  TYPES_WITH_ACCESS_DETAILS,
  ACCESS_DETAIL_FIELD_KEYS,
  hasClosingVariants,
  hasAccessDetails,
  readEmailTemplates,
  writeEmailTemplate,
  applyPlaceholders,
  renderTemplateFields,
  stripHtml,
  getPlainDefaultTemplates,
}
