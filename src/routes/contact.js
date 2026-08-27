const express = require('express')
const router = express.Router()
const path = require('path')
const rateLimit = require('express-rate-limit')
const { readJSON, writeJSON } = require('../utils/json-store')
const { getConcernOptions } = require('../utils/concern-options')
const { getFacultyOptions, resolveFaculty } = require('../utils/faculty-options')
const { getAudienceFields, normalizeAudience } = require('../utils/registration-audience-fields')
const {
  verifyFormToken,
  isHoneypotClear,
  verifyTurnstile,
} = require('../utils/public-form-protection')

const dataFile = path.join(__dirname, '../../data/contacts.json')
const contentFile = path.join(__dirname, '../../data/content.json')
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000
const VALID_SESSION_TYPES = new Set(['online', 'phone', 'onsite'])

function readData() { return readJSON(dataFile) }
function writeData(data) { writeJSON(dataFile, data) }
function clean(value) { return typeof value === 'string' ? value.trim() : '' }

function enabledSessionTypes(content = readJSON(contentFile, {})) {
  const configured = content.book && content.book.sessionTypes
  const defaults = { online: true, phone: false, onsite: true }
  const settings = { ...defaults, ...(configured || {}) }
  return new Set([...VALID_SESSION_TYPES].filter(type => settings[type]))
}

function validateContact(body, allowedSessionTypes = enabledSessionTypes(), facultyOptions = getFacultyOptions(), concernOptions = getConcernOptions(), audienceFields) {
  const audience = normalizeAudience(body.audience)
  const fields = { studentId:true, faculty:true, phone:true, email:true, concern:true, sessionType:true, ...(audienceFields || {}) }
  const selectedFaculty = fields.faculty ? resolveFaculty(body.facultyIndex, facultyOptions) : null
  const requestedSessionType = fields.sessionType ? clean(body.type) : (allowedSessionTypes.values().next().value || '')
  const contact = {
    audience,
    name: clean(body.name),
    nickname: clean(body.nickname),
    studentId: fields.studentId ? clean(body.studentId) : '',
    facultyIndex: selectedFaculty ? selectedFaculty.facultyIndex : '',
    faculty: selectedFaculty ? selectedFaculty.faculty : '',
    facultyEn: selectedFaculty ? selectedFaculty.facultyEn : '',
    phone: fields.phone ? clean(body.phone) : '',
    email: fields.email ? clean(body.email).toLowerCase() : '',
    concern: fields.concern ? clean(body.concern) : '',
    sessionType: requestedSessionType,
  }
  const phoneDigits = contact.phone.replace(/\D/g, '')
  const consented = ['on', 'true', '1'].includes(clean(body.pdpa_consent).toLowerCase())
  const allowedConcerns = new Set(concernOptions)

  if (contact.name.length < 2 || contact.name.length > 100) return null
  if (contact.nickname.length > 100) return null
  if (fields.studentId && !/^[\p{L}\p{N}._/-]{3,30}$/u.test(contact.studentId)) return null
  if (fields.faculty && !selectedFaculty) return null
  if (fields.phone && (phoneDigits.length < 9 || phoneDigits.length > 15)) return null
  if (fields.email && (contact.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))) return null
  if (!VALID_SESSION_TYPES.has(contact.sessionType) || !allowedSessionTypes.has(contact.sessionType)) return null
  if (fields.concern && (contact.concern.length > 200 || (contact.concern && !allowedConcerns.has(contact.concern)))) return null
  if (!consented) return null

  contact.phone = phoneDigits
  return contact
}

function isRecentDuplicate(data, contact, now = Date.now()) {
  return data.some(item => {
    const submittedAt = Date.parse(item.submittedAt || '')
    if (!Number.isFinite(submittedAt) || now - submittedAt > DUPLICATE_WINDOW_MS) return false
    const comparable = []
    if (contact.studentId) comparable.push(clean(item.studentId).toLowerCase() === contact.studentId.toLowerCase())
    if (contact.email) comparable.push(clean(item.email).toLowerCase() === contact.email)
    if (comparable.length) return comparable.every(Boolean)
    return normalizeAudience(item.audience) === contact.audience && clean(item.name).toLowerCase() === contact.name.toLowerCase()
  })
}

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.redirect('/?error=rate#book'),
})

router.post('/', contactLimiter, async (req, res) => {
  const body = req.body || {}
  if (!isHoneypotClear(body.company_website) || !verifyFormToken(body.form_token)) {
    return res.redirect('/?error=spam#book')
  }

  const content = readJSON(contentFile, {})
  const contact = validateContact(
    body,
    enabledSessionTypes(content),
    getFacultyOptions(),
    getConcernOptions(),
    getAudienceFields(content, body.audience)
  )
  if (!contact) return res.redirect('/?error=invalid#book')

  const turnstileOk = await verifyTurnstile({
    token: body['cf-turnstile-response'],
    remoteIp: req.ip,
    action: 'contact',
  })
  if (!turnstileOk) return res.redirect('/?error=verification#book')

  const data = readData()
  if (isRecentDuplicate(data, contact)) return res.redirect('/?error=duplicate#book')

  const now = new Date()
  data.push({
    id: 'req' + now.getTime().toString().slice(-8),
    audience: contact.audience,
    name: contact.name,
    nickname: contact.nickname,
    studentId: contact.studentId,
    facultyIndex: contact.facultyIndex,
    faculty: contact.faculty,
    facultyEn: contact.facultyEn,
    phone: contact.phone,
    email: contact.email,
    concern: contact.concern,
    sessionType: contact.sessionType,
    status: 'new',
    note: '',
    createdAt: now.toISOString().split('T')[0],
    submittedAt: now.toISOString(),
  })
  writeData(data)
  res.redirect('/?sent=1#book')
})

module.exports = router
module.exports.validateContact = validateContact
module.exports.isRecentDuplicate = isRecentDuplicate
