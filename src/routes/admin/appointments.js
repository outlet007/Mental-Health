const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const { ensureToken, verifyToken, verifyParsedToken } = require('../../middleware/csrf')
router.use(ensureToken)
router.use(verifyToken)
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const crypto = require('crypto')
const { sendAppointmentEmails, sendSurveyEmail, sendCounselorReassignedEmail } = require('../../utils/mailer')
const { resolveAppointmentEmailOptions, resolveReassignedEmailOptions, resolveSurveyEmailOptions } = require('../../utils/survey-email-settings')
const { findAvailableSlot, listAvailableSlots } = require('../../utils/availability')
const { filterAppointmentsByStatus, resolveAppointmentStatusFilter } = require('../../utils/appointment-status-filter')
const { recordSurveyEmailSent } = require('../../utils/survey-delivery')
const { logDeletion } = require('../../utils/audit-log')
const { getConcernOptions } = require('../../utils/concern-options')
const { readJSON, writeJSON } = require('../../utils/json-store')
const {
  ensureActiveCase,
  createCase,
  closeCase,
  normalizeRiskLevel,
  normalizeDisposition,
  ensureCaseAndAppointmentNumbers,
} = require('../../utils/case-management')
const {
  MAX_ATTACHMENT_SIZE,
  deleteConsultationAttachment,
  isAllowedDocument,
  readConsultationAttachment,
  saveConsultationAttachment,
} = require('../../utils/consultation-attachments')

const dataDir = path.join(__dirname, '../../../data')
const DEFAULT_SESSION_TYPES = { online: true, phone: false, onsite: true }
const APPOINTMENT_TYPE_SEARCH_LABELS = {
  online: '\u0e2d\u0e2d\u0e19\u0e44\u0e25\u0e19\u0e4c',
  phone: '\u0e42\u0e17\u0e23\u0e28\u0e31\u0e1e\u0e17\u0e4c',
  onsite: '\u0e40\u0e02\u0e49\u0e32\u0e23\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e14\u0e49\u0e27\u0e22\u0e15\u0e19\u0e40\u0e2d\u0e07',
}
const APPOINTMENT_STATUS_SEARCH_LABELS = {
  pending: '\u0e23\u0e2d\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e19\u0e31\u0e14',
  confirmed: '\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e41\u0e25\u0e49\u0e27',
  completed: '\u0e40\u0e2a\u0e23\u0e47\u0e08\u0e2a\u0e34\u0e49\u0e19',
  cancelled: '\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e19\u0e31\u0e14',
}
const consultationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 },
  fileFilter: (req, file, callback) => {
    if (isAllowedDocument(file)) return callback(null, true)
    callback(new Error('รองรับเฉพาะไฟล์ PDF, DOC และ DOCX'))
  },
}).single('counselorAttachment')

function parseConsultationAttachment(req, res, next) {
  consultationUpload(req, res, error => {
    if (error) return res.redirect('/admin/appointments?error=attachment')
    next()
  })
}

function applyAttachmentUpdate(appointment, file, removeRequested) {
  const previous = appointment.counselorAttachment || null
  let replacement = null
  if (file) replacement = saveConsultationAttachment(file)

  if (replacement) appointment.counselorAttachment = replacement
  else if (removeRequested) delete appointment.counselorAttachment

  return {
    previous,
    replacement,
    shouldDeletePrevious: Boolean(previous && (replacement || removeRequested)),
  }
}

// สีอ้างอิงต่อนักจิตวิทยา — ต้องตรงกับ COLORS ใน src/routes/admin/schedules.js
const COUNSELOR_COLORS = ['#6366f1','#05967e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#10b981','#f43f5e']

function read(file) { return readJSON(path.join(dataDir, file)) }
function write(file, d) { writeJSON(path.join(dataDir, file), d) }
function readCases() { return readJSON(path.join(dataDir, 'cases.json'), []) }

function readAppointmentSessionTypes() {
  try {
    const content = read('content.json')
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

function appointmentSearchValues(appointment) {
  const durationLabel = appointment.duration == null
    ? ''
    : `${appointment.duration} \u0e19\u0e32\u0e17\u0e35`

  return [
    appointment.appointmentNumber,
    appointment.caseCode,
    appointment.id,
    appointment.clientName,
    appointment.counselorName,
    appointment.date,
    appointment.time,
    `${appointment.date || ''} ${appointment.time || ''}`,
    appointment.type,
    APPOINTMENT_TYPE_SEARCH_LABELS[appointment.type],
    appointment.duration,
    durationLabel,
    appointment.status,
    APPOINTMENT_STATUS_SEARCH_LABELS[appointment.status],
    appointment.note,
  ]
}

function filterAppointmentsBySearch(appointments, search) {
  if (!search) return appointments
  return appointments.filter(appointment => matchesSearch(appointmentSearchValues(appointment), search))
}

function isCounselor(req) {
  return req.session.userType === 'counselor'
}

function canUseCounselor(req, counselorId) {
  return !isCounselor(req) || counselorId === req.session.counselorId
}

function canUseAppointment(req, appointment) {
  return !isCounselor(req) || appointment.counselorId === req.session.counselorId
}

// Reading treatment records is shared across the client's care team. A
// counselor joins that care team once at least one appointment links them to
// the same client. Mutating an appointment still uses canUseAppointment().
function canViewAppointment(req, appointment) {
  if (!isCounselor(req)) return true
  return Boolean(appointment?.clientId) && canUseClient(req, appointment.clientId)
}

function canUseClient(req, clientId) {
  if (!isCounselor(req)) return true
  return read('appointments.json').some(a =>
    a.counselorId === req.session.counselorId && a.clientId === clientId
  )
}

function forbidden(res) {
  return res.status(403).send('Forbidden')
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const appointments = read('appointments.json')
  let counselors     = read('counselors.json').filter(c => c.isApproved)
  let clients        = read('clients.json')

  // สีต่อนักจิตวิทยา อ้างอิงลำดับเดียวกับตารางเวลา (มุมมอง admin) เพื่อให้สีตรงกันทั้งระบบ
  const counselorColors = {}
  counselors.forEach((c, i) => { counselorColors[c.id] = COUNSELOR_COLORS[i % COUNSELOR_COLORS.length] })

  const { type, search, counselorId } = req.query
  const status = resolveAppointmentStatusFilter(req.query.status, isCounselor(req))
  let filtered = appointments
  let clientAppointments = appointments

  // Counselors see only their own appointments and clients
  if (isCounselor(req)) {
    filtered   = filtered.filter(a => a.counselorId === req.session.counselorId)
    counselors = counselors.filter(c => c.id === req.session.counselorId)
    const myClientIds = new Set(filtered.map(a => a.clientId))
    clients = clients.filter(c => myClientIds.has(c.id))
    // ประวัตินัดหมายเต็มของผู้รับบริการที่ตนดูแล (ทุกนักจิตวิทยา) สำหรับ modal ดูข้อมูล
    clientAppointments = appointments.filter(a => myClientIds.has(a.clientId))
  } else {
    if (counselorId) filtered = filtered.filter(a => a.counselorId === counselorId)
  }

  const myStatusCounts = {
    pending:   filtered.filter(a => a.status === 'pending').length,
    confirmed: filtered.filter(a => a.status === 'confirmed').length,
    completed: filtered.filter(a => a.status === 'completed').length,
    cancelled: filtered.filter(a => a.status === 'cancelled').length,
  }

  filtered = filterAppointmentsByStatus(filtered, status, isCounselor(req))
  if (type)   filtered = filtered.filter(a => a.type === type)
  filtered = filterAppointmentsBySearch(filtered, search)
  filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date))

  const schedules = isCounselor(req)
    ? read('schedules.json').filter(s => s.counselorId === req.session.counselorId)
    : read('schedules.json')
  const appointmentSessionTypes = readAppointmentSessionTypes()

  const counselorActiveCounts = {}
  appointments.forEach(a => {
    if (a.status === 'pending' || a.status === 'confirmed') {
      counselorActiveCounts[a.counselorId] = (counselorActiveCounts[a.counselorId] || 0) + 1
    }
  })

  res.render('admin/appointments', {
    page: 'appointments',
    title: 'จัดการนัดหมาย',
    appointments: filtered,
    clientAppointments,
    concernOptions: getConcernOptions(),
    counselorColors,
    counselors,
    clients,
    schedules,
    appointmentSessionTypes,
    counselorActiveCounts,
    myStatusCounts,
    query: { ...req.query, status },
    userType: req.session.userType || 'admin',
  })
})

// ── API: available slots (JSON) ───────────────────────────────────────────────
router.get('/slots', (req, res) => {
  const { counselorId, date, excludeId } = req.query
  if (!counselorId || !date) return res.json({ slots: [], error: 'missing params' })
  if (!canUseCounselor(req, counselorId)) return res.status(403).json({ slots: [], error: 'forbidden' })
  const slots = listAvailableSlots({
    schedules: read('schedules.json'),
    appointments: read('appointments.json'),
    counselorId,
    date,
    excludeAppointmentId: excludeId,
  })
  res.json({ slots })
})

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const { counselorId, clientId, date, time, type, note, concern, meetingLink } = req.body
  const sessionTypes = readAppointmentSessionTypes()
  const appointmentType = normalizeAppointmentType(type || 'online', sessionTypes)

  if (!canUseCounselor(req, counselorId) || !canUseClient(req, clientId)) return forbidden(res)

  const counselors = read('counselors.json')
  const clients    = read('clients.json')
  const counselor  = counselors.find(c => c.id === counselorId)
  const client     = clients.find(c => c.id === clientId)

  if (!counselor || !client) return res.redirect('/admin/appointments?error=invalid')

  const appointments = read('appointments.json')
  const selectedSlot = findAvailableSlot({
    schedules: read('schedules.json'),
    appointments,
    counselorId,
    date,
  }, time)
  if (!selectedSlot) return res.redirect('/admin/appointments?error=conflict')
  const duration = selectedSlot.duration

  const maxNum = appointments.reduce((max, a) => {
    const m = String(a.id).match(/^app-(\d+)(?:-\d+)?$/)
    return m ? Math.max(max, parseInt(m[1])) : max
  }, 0)

  const cases = readCases()
  const caseCountBefore = cases.length
  const activeCase = ensureActiveCase(cases, {
    clientId,
    openedAt: date,
    concern: (concern || '').trim(),
  })

  const newAppt = {
    id:            'app-' + String(maxNum + 1).padStart(5, '0'),
    caseId:        activeCase.id,
    clientId,
    clientName:    client.name,
    counselorId,
    counselorName: counselor.name,
    date,
    time,
    duration,
    type:          appointmentType,
    meetingLink:   cleanMeetingLink(appointmentType, meetingLink),
    status:        'confirmed',
    note:          note || '',
    concern:       (concern || '').trim(),
    createdAt:     new Date().toISOString().split('T')[0],
  }

  appointments.push(newAppt)
  const numbering = ensureCaseAndAppointmentNumbers(cases, appointments)
  write('appointments.json', appointments)
  if (cases.length !== caseCountBefore || numbering.casesChanged) write('cases.json', cases)

  const emailOptions = resolveAppointmentEmailOptions(
    { name: client.name, email: client.email || '', phone: client.phone || '' },
    { name: counselor.name, title: counselor.title, email: counselor.email, phone: counselor.phone, specialties: counselor.specialties }
  )
  sendAppointmentEmails({
    appointment: newAppt,
    concern:     newAppt.concern,
    ...emailOptions,
  }).catch(err => console.error('[Email] unexpected error:', err.message))

  res.redirect('/admin/appointments?created=1')
})

// ── EDIT ──────────────────────────────────────────────────────────────────────
router.post('/:id/edit', (req, res) => {
  const { counselorId, date, time, type, status, note, concern, meetingLink } = req.body
  const sessionTypes = readAppointmentSessionTypes()
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx === -1) return res.redirect('/admin/appointments?updated=1')

  const current = data[idx]
  if (!canUseAppointment(req, current)) return forbidden(res)

  const counselorRole = isCounselor(req)
  const counselors = read('counselors.json')

  // Counselors may only reschedule their own appointments — no counselor
  // reassignment, type, status, or note changes.
  const requestedCounselorId = counselorRole ? current.counselorId : (counselorId || current.counselorId)
  const newCounselor = counselors.find(c => c.id === requestedCounselorId)
  if (!newCounselor) return res.redirect('/admin/appointments?error=invalid')

  const counselorChanged = requestedCounselorId !== current.counselorId
  const newDate = date || current.date
  const newTime = time || current.time
  const scheduleChanged = newDate !== current.date || newTime !== current.time || counselorChanged
  let duration = current.duration || 60

  if (scheduleChanged) {
    const selectedSlot = findAvailableSlot({
      schedules: read('schedules.json'),
      appointments: data,
      counselorId: requestedCounselorId,
      date: newDate,
      excludeAppointmentId: current.id,
    }, newTime)
    if (!selectedSlot) return res.redirect('/admin/appointments?error=conflict')
    duration = selectedSlot.duration
  }

  const oldCounselor = counselors.find(c => c.id === current.counselorId)

  data[idx].counselorId   = requestedCounselorId
  data[idx].counselorName = newCounselor.name
  data[idx].duration      = duration
  data[idx].date          = newDate
  data[idx].time          = newTime
  if (scheduleChanged) data[idx].reminderSent = false
  if (!counselorRole) {
    if (type) {
      data[idx].type = normalizeAppointmentType(type, sessionTypes)
      data[idx].meetingLink = cleanMeetingLink(data[idx].type, meetingLink)
    }
    if (status && status !== 'completed') data[idx].status = status
    if (note !== undefined) data[idx].note = note.trim()
    if (concern !== undefined) data[idx].concern = concern.trim()
  }
  write('appointments.json', data)

  if (scheduleChanged) {
    const clients = read('clients.json')
    const client  = clients.find(c => c.id === current.clientId)

    if (client) {
      const emailOptions = resolveAppointmentEmailOptions(
        { name: client.name, email: client.email || '', phone: client.phone || '' },
        { name: newCounselor.name, title: newCounselor.title, email: newCounselor.email, phone: newCounselor.phone, specialties: newCounselor.specialties }
      )
      sendAppointmentEmails({
        appointment: data[idx],
        concern:     data[idx].concern || '',
        ...emailOptions,
      }).catch(err => console.error('[Email] unexpected error:', err.message))

      if (counselorChanged && oldCounselor) {
        const reassignedOptions = resolveReassignedEmailOptions({ name: oldCounselor.name, email: oldCounselor.email })
        if (!reassignedOptions.skip) {
          sendCounselorReassignedEmail({
            appointment: current,
            client:      { name: client.name },
            counselor:   reassignedOptions.counselor,
            deliveryConfig: reassignedOptions.deliveryConfig,
          }).catch(err => console.error('[Email] unexpected error:', err.message))
        }
      }
    }
  }

  res.redirect('/admin/appointments?updated=1')
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/:id/delete', (req, res) => {
  const data = read('appointments.json')
  const appt = data.find(a => a.id === req.params.id)
  if (appt && !canUseAppointment(req, appt)) return forbidden(res)
  write('appointments.json', data.filter(a => a.id !== req.params.id))
  if (appt) {
    deleteConsultationAttachment(appt.counselorAttachment)
    logDeletion({
      entityType: 'appointment',
      entityId:   appt.id,
      entityName: `${appt.clientName} - ${appt.counselorName} (${appt.date})`,
      reason:     req.body.reason,
      req,
    })
  }
  res.redirect('/admin/appointments?deleted=1')
})

// Documents attached to consultation notes contain sensitive health data.
// They are stored outside public/ and can only be downloaded after the
// regular admin auth middleware and the client care-team access check pass.
router.get('/:id/consultation-attachment', (req, res) => {
  const appointment = read('appointments.json').find(a => a.id === req.params.id)
  if (!appointment) return res.status(404).send('Document not found')
  if (!canViewAppointment(req, appointment)) return forbidden(res)
  if (!appointment.counselorAttachment) return res.status(404).send('Document not found')

  try {
    const metadata = appointment.counselorAttachment
    const contents = readConsultationAttachment(metadata)
    res.set('Cache-Control', 'no-store, private')
    res.type(metadata.contentType || 'application/octet-stream')
    res.attachment(metadata.originalName || 'consultation-document')
    res.send(contents)
  } catch (error) {
    console.error('[Consultation attachment] read error:', error.message)
    res.status(404).send('Document not found')
  }
})

// ── EDIT COUNSELOR NOTE ───────────────────────────────────────────────────────
router.post('/:id/edit-note', parseConsultationAttachment, verifyParsedToken, (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (!canUseAppointment(req, data[idx])) return forbidden(res)
    let attachmentUpdate
    try {
      attachmentUpdate = applyAttachmentUpdate(
        data[idx],
        req.file,
        req.body.removeCounselorAttachment === '1'
      )
    } catch (error) {
      return res.redirect('/admin/appointments?error=attachment')
    }
    data[idx].counselorNote = (req.body.counselorNote || '').trim()
    try {
      write('appointments.json', data)
    } catch (error) {
      if (attachmentUpdate.replacement) deleteConsultationAttachment(attachmentUpdate.replacement)
      throw error
    }
    if (attachmentUpdate.shouldDeletePrevious) deleteConsultationAttachment(attachmentUpdate.previous)
  }
  res.redirect('/admin/appointments?updated=1')
})

// ── STATUS ACTIONS ────────────────────────────────────────────────────────────
router.post('/:id/confirm', (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (!canUseAppointment(req, data[idx])) return forbidden(res)
    data[idx].status = 'confirmed'; write('appointments.json', data)
  }
  res.redirect('/admin/appointments')
})

router.post('/:id/complete', parseConsultationAttachment, verifyParsedToken, (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (!canUseAppointment(req, data[idx])) return forbidden(res)
    const appt = data[idx]
    const cases = readCases()
    const caseCountBefore = cases.length
    if (!appt.caseId) {
      appt.caseId = ensureActiveCase(cases, {
        clientId: appt.clientId,
        openedAt: appt.date,
        concern: appt.concern || '',
      }).id
    }
    let casesChanged = cases.length !== caseCountBefore
    let attachmentUpdate
    try {
      attachmentUpdate = applyAttachmentUpdate(appt, req.file, false)
    } catch (error) {
      return res.redirect('/admin/appointments?error=attachment')
    }
    appt.status = 'completed'
    if (req.body.counselorNote !== undefined) {
      appt.counselorNote = req.body.counselorNote.trim()
    }
    appt.symptoms = String(req.body.symptoms || '').trim()
    appt.riskLevel = normalizeRiskLevel(req.body.riskLevel)
    appt.riskDetail = String(req.body.riskDetail || '').trim()
    appt.caseDisposition = normalizeDisposition(req.body.caseDisposition)
    appt.closedReason = appt.caseDisposition === 'closed' ? String(req.body.closedReason || '').trim() : ''
    appt.referralRequired = req.body.referralRequired === 'on' || req.body.referralRequired === 'true'
    appt.referralDestination = appt.referralRequired ? String(req.body.referralDestination || '').trim() : ''
    appt.referralReason = appt.referralRequired ? String(req.body.referralReason || '').trim() : ''
    appt.completedAt = new Date().toISOString()

    if (appt.caseDisposition === 'closed') {
      closeCase(cases, appt.caseId, {
        closedAt: appt.date,
        reason: req.body.closedReason,
      })
      casesChanged = true

      const currentKey = `${appt.date || ''}T${appt.time || ''}`
      const futureAppointments = data
        .filter(item => item.id !== appt.id && item.caseId === appt.caseId && item.status !== 'cancelled')
        .filter(item => `${item.date || ''}T${item.time || ''}` > currentKey)
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
      if (futureAppointments.length) {
        const nextCase = createCase(cases, {
          clientId: appt.clientId,
          openedAt: futureAppointments[0].date,
          concern: futureAppointments[0].concern || appt.concern || '',
        })
        futureAppointments.forEach((item, index) => {
          item.caseId = nextCase.id
          delete item.caseCode
          item.visitNumber = index + 1
          delete item.appointmentNumber
        })
      }
    }
    if (!appt.surveyToken) {
      appt.surveyToken = crypto.randomBytes(16).toString('hex')
    }
    const numbering = ensureCaseAndAppointmentNumbers(cases, data)
    casesChanged = casesChanged || numbering.casesChanged
    try {
      write('appointments.json', data)
      if (casesChanged) write('cases.json', cases)
    } catch (error) {
      if (attachmentUpdate.replacement) deleteConsultationAttachment(attachmentUpdate.replacement)
      throw error
    }
    if (attachmentUpdate.shouldDeletePrevious) deleteConsultationAttachment(attachmentUpdate.previous)

    const clients    = read('clients.json')
    const counselors = read('counselors.json')
    const client     = clients.find(c => c.id === appt.clientId)
    const counselor  = counselors.find(c => c.id === appt.counselorId)
    if (client && counselor) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
      const surveyOptions = resolveSurveyEmailOptions(client)
      if (!surveyOptions.skip) {
        sendSurveyEmail({
          appointment: appt,
          client: surveyOptions.client,
          counselor,
          surveyUrl: `${baseUrl}/survey/${appt.surveyToken}`,
          deliveryConfig: surveyOptions.deliveryConfig,
        }).then(() => {
          recordSurveyEmailSent(appt.id, dataDir)
        }).catch(err => console.error('[Email] survey error:', err.message))
      }
    }
  }
  res.redirect('/admin/appointments')
})

router.post('/:id/cancel', (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (!canUseAppointment(req, data[idx])) return forbidden(res)
    data[idx].status = 'cancelled'; write('appointments.json', data)
  }
  res.redirect('/admin/appointments')
})

module.exports = router
module.exports.filterAppointmentsBySearch = filterAppointmentsBySearch
