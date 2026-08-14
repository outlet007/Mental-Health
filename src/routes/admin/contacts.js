const express = require('express')
const router  = express.Router()
const { ensureToken, verifyToken } = require('../../middleware/csrf')
router.use(ensureToken)
router.use(verifyToken)
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const { sendAppointmentEmails } = require('../../utils/mailer')
const { resolveAppointmentEmailOptions } = require('../../utils/survey-email-settings')
const { logDeletion } = require('../../utils/audit-log')
const { getConcernOptions } = require('../../utils/concern-options')
const { getFacultyOptions, resolveFaculty } = require('../../utils/faculty-options')
const { readJSON, writeJSON } = require('../../utils/json-store')

const dataDir  = path.join(__dirname, '../../../data')
const dataFile = path.join(dataDir, 'contacts.json')
const DEFAULT_SESSION_TYPES = { online: true, phone: false, onsite: true }

// สีอ้างอิงต่อนักจิตวิทยา — ต้องตรงกับ COLORS ใน src/routes/admin/schedules.js
const COUNSELOR_COLORS = ['#6366f1','#05967e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#10b981','#f43f5e']

function readFile(file) { return readJSON(path.join(dataDir, file)) }
function readData()     { return readJSON(dataFile) }
function writeData(d)   { writeJSON(dataFile, d) }

function readAppointmentSessionTypes() {
  try {
    const content = readFile('content.json')
    return { ...DEFAULT_SESSION_TYPES, ...(content.book?.sessionTypes || {}) }
  } catch {
    return { ...DEFAULT_SESSION_TYPES }
  }
}

function firstEnabledSessionType(sessionTypes) {
  return ['online', 'phone', 'onsite'].find(type => sessionTypes[type]) || 'online'
}

function normalizeAppointmentType(type, sessionTypes) {
  return sessionTypes[type] ? type : firstEnabledSessionType(sessionTypes)
}

function cleanMeetingLink(type, meetingLink) {
  return type === 'online' ? (meetingLink || '').trim() : ''
}

router.get('/', (req, res) => {
  const contacts     = readData()
  const counselors   = readFile('counselors.json').filter(c => c.isApproved)
  const schedules    = readFile('schedules.json')

  // สีต่อนักจิตวิทยา อ้างอิงลำดับเดียวกับตารางเวลา (มุมมอง admin) เพื่อให้สีตรงกันทั้งระบบ
  const counselorColors = {}
  counselors.forEach((c, i) => { counselorColors[c.id] = COUNSELOR_COLORS[i % COUNSELOR_COLORS.length] })
  const clients      = readFile('clients.json')
  const appointments = readFile('appointments.json')

  const concernOptions = getConcernOptions()
  const appointmentSessionTypes = readAppointmentSessionTypes()

  const { search, status, concern } = req.query
  let filtered = contacts
  if (status)  filtered = filtered.filter(c => c.status === status)
  if (concern) filtered = filtered.filter(c => c.concern === concern)
  if (search) filtered = filtered.filter(c => matchesSearch([
    c.name,
    c.phone,
    c.email,
    c.studentId,
    c.faculty,
    c.facultyEn,
  ], search))
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const counselorActiveCounts = {}
  appointments.forEach(a => {
    if (a.status === 'pending' || a.status === 'confirmed') {
      counselorActiveCounts[a.counselorId] = (counselorActiveCounts[a.counselorId] || 0) + 1
    }
  })

  const statusCounts = {
    new:       contacts.filter(c => c.status === 'new').length,
    contacted: contacts.filter(c => c.status === 'contacted').length,
    converted: contacts.filter(c => c.status === 'converted').length,
    closed:    contacts.filter(c => c.status === 'closed').length,
  }

  res.render('admin/contacts', {
    page: 'contacts', title: 'คำขอเพื่อทำนัดหมาย',
    contacts: filtered, query: req.query,
    total: contacts.length, statusCounts, concernOptions, counselorColors,
    counselors, schedules, clients, appointments, counselorActiveCounts, appointmentSessionTypes,
    facultyOptions: getFacultyOptions(),
  })
})

router.post('/:id/status', (req, res) => {
  const { status, note } = req.body
  const data = readData()
  const idx  = data.findIndex(c => c.id === req.params.id)
  if (idx !== -1) {
    data[idx].status = status
    if (note !== undefined) data[idx].note = note.trim()
    writeData(data)
  }
  res.redirect('/admin/contacts?updated=1')
})

router.post('/:id/edit', (req, res) => {
  const { name, studentId, facultyIndex, phone, email, concern, sessionType } = req.body
  const facultySelection = resolveFaculty(facultyIndex)
  const sessionTypes = readAppointmentSessionTypes()
  const data = readData()
  const idx  = data.findIndex(c => c.id === req.params.id)
  if (idx !== -1) {
    data[idx].name        = (name || '').trim()
    data[idx].studentId    = (studentId || '').trim()
    if (facultySelection) {
      data[idx].facultyIndex = facultySelection.facultyIndex
      data[idx].faculty = facultySelection.faculty
      data[idx].facultyEn = facultySelection.facultyEn
    }
    data[idx].phone        = (phone || '').trim()
    data[idx].email        = (email || '').trim()
    data[idx].concern      = concern || ''
    data[idx].sessionType  = normalizeAppointmentType(sessionType || data[idx].sessionType || 'online', sessionTypes)
    writeData(data)
  }
  res.redirect('/admin/contacts?updated=1')
})

router.post('/:id/book', async (req, res) => {
  const { counselorId, date, time, type, note, existingClientId, meetingLink } = req.body
  const sessionTypes = readAppointmentSessionTypes()
  const appointmentType = normalizeAppointmentType(type || 'online', sessionTypes)
  const contacts = readData()
  const idx      = contacts.findIndex(c => c.id === req.params.id)
  if (idx === -1) return res.redirect('/admin/contacts?error=notfound')

  const contact    = contacts[idx]
  const counselors = readFile('counselors.json')
  const counselor  = counselors.find(c => c.id === counselorId)
  if (!counselor) return res.redirect('/admin/contacts?error=invalid')

  // Double-booking guard
  const appointments = readFile('appointments.json')
  const conflict = appointments.some(a =>
    a.counselorId === counselorId && a.date === date && a.time === time && a.status !== 'cancelled'
  )
  if (conflict) return res.redirect('/admin/contacts?error=conflict')

  // ผู้รับบริการ: ใช้ตัวที่ admin ยืนยันเลือกไว้ (existingClientId) เท่านั้น
  // ไม่ auto-match ด้วยเบอร์โทร/อีเมลอีกต่อไป — ป้องกันการ merge ข้อมูลผิดคนโดยไม่ได้ตั้งใจ
  const clientsFile = path.join(dataDir, 'clients.json')
  const clients = readJSON(clientsFile)
  let client = existingClientId ? clients.find(c => c.id === existingClientId) : null
  if (!client) {
    client = {
      id: 'cl' + Date.now().toString().slice(-6),
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      studentId: contact.studentId || '',
      facultyIndex: contact.facultyIndex || '',
      faculty: contact.faculty || '',
      facultyEn: contact.facultyEn || '',
      status: 'active',
      totalSessions: 0,
      createdAt: new Date().toISOString().split('T')[0],
    }
    clients.push(client)
    writeJSON(clientsFile, clients)
  }

  const apptFile = path.join(dataDir, 'appointments.json')
  const appts    = readJSON(apptFile)
  const maxNum = appts.reduce((max, a) => {
    const m = String(a.id).match(/^app-(\d+)$/)
    return m ? Math.max(max, parseInt(m[1])) : max
  }, 0)

  const newAppt  = {
    id:            'app-' + String(maxNum + 1).padStart(5, '0'),
    clientId:      client.id,
    clientName:    client.name,
    counselorId,
    counselorName: counselor.name,
    date, time,
    duration:      counselor.sessionDuration || 60,
    type:          normalizeAppointmentType(type || contact.sessionType || appointmentType, sessionTypes),
    meetingLink:   cleanMeetingLink(normalizeAppointmentType(type || contact.sessionType || appointmentType, sessionTypes), meetingLink),
    status:        'confirmed',
    note:          note || '',
    concern:       contact.concern || '',
    createdAt:     new Date().toISOString().split('T')[0],
  }
  appts.push(newAppt)
  writeJSON(apptFile, appts)

  contacts[idx].status = 'converted'
  contacts[idx].appointmentId = newAppt.id
  writeData(contacts)

  // ส่งอีเมลแจ้งทั้งสองฝ่าย (ไม่รอ — redirect ทันที)
  const emailOptions = resolveAppointmentEmailOptions(
    { name: client.name, email: client.email, phone: client.phone },
    { name: counselor.name, title: counselor.title, email: counselor.email, phone: counselor.phone, specialties: counselor.specialties }
  )
  sendAppointmentEmails({
    appointment: newAppt,
    concern:     contact.concern || '',
    ...emailOptions,
  }).catch(err => console.error('[Email] unexpected error:', err.message))

  res.redirect('/admin/contacts?booked=1')
})

router.post('/:id/delete', (req, res) => {
  const data    = readData()
  const contact = data.find(c => c.id === req.params.id)
  writeData(data.filter(c => c.id !== req.params.id))
  if (contact) {
    logDeletion({ entityType: 'contact', entityId: contact.id, entityName: contact.name, reason: req.body.reason, req })
  }
  res.redirect('/admin/contacts')
})

module.exports = router
