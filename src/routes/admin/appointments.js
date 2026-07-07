const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const crypto = require('crypto')
const { sendAppointmentEmails, sendSurveyEmail, sendCounselorReassignedEmail } = require('../../utils/mailer')
const { resolveAppointmentEmailOptions, resolveReassignedEmailOptions, resolveSurveyEmailOptions } = require('../../utils/survey-email-settings')
const { toMin, timesOverlap } = require('../../utils/appointment-scheduling')
const { logDeletion } = require('../../utils/audit-log')
const { getConcernOptions } = require('../../utils/concern-options')

const dataDir = path.join(__dirname, '../../../data')

// สีอ้างอิงต่อนักจิตวิทยา — ต้องตรงกับ COLORS ใน src/routes/admin/schedules.js
const COUNSELOR_COLORS = ['#6366f1','#05967e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#10b981','#f43f5e']

function read(file) { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }
function write(file, d) { fs.writeFileSync(path.join(dataDir, file), JSON.stringify(d, null, 2)) }

function isCounselor(req) {
  return req.session.userType === 'counselor'
}

function canUseCounselor(req, counselorId) {
  return !isCounselor(req) || counselorId === req.session.counselorId
}

function canUseAppointment(req, appointment) {
  return !isCounselor(req) || appointment.counselorId === req.session.counselorId
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

// Generate time slots from counselor schedule for a given date,
// excluding already-booked slots.
function getAvailableSlots(counselorId, dateStr, excludeId) {
  const schedules    = read('schedules.json')
  const appointments = read('appointments.json')

  const date     = new Date(dateStr)
  const dow      = date.getDay()
  const schedule = schedules.find(s => s.counselorId === counselorId && s.dayOfWeek === dow && s.isActive)
  if (!schedule) return []

  const counselor = read('counselors.json').find(c => c.id === counselorId)
  const duration  = counselor?.sessionDuration || 60

  const toStr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  const start = toMin(schedule.startTime)
  const end   = toMin(schedule.endTime)

  const booked = appointments
    .filter(a => a.counselorId === counselorId && a.date === dateStr && a.status !== 'cancelled' && a.id !== excludeId)
    .map(a => ({ start: toMin(a.time), duration: a.duration || duration }))

  const slots = []
  for (let t = start; t + duration <= end; t += duration) {
    const conflict = booked.some(b => timesOverlap(t, duration, b.start, b.duration))
    slots.push({ time: toStr(t), available: !conflict })
  }
  return slots
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const appointments = read('appointments.json')
  let counselors     = read('counselors.json').filter(c => c.isApproved)
  let clients        = read('clients.json')

  // สีต่อนักจิตวิทยา อ้างอิงลำดับเดียวกับตารางเวลา (มุมมอง admin) เพื่อให้สีตรงกันทั้งระบบ
  const counselorColors = {}
  counselors.forEach((c, i) => { counselorColors[c.id] = COUNSELOR_COLORS[i % COUNSELOR_COLORS.length] })

  const { status, type, search, counselorId } = req.query
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

  if (status) filtered = filtered.filter(a => a.status === status)
  if (type)   filtered = filtered.filter(a => a.type === type)
  if (search) filtered = filtered.filter(a => matchesSearch([
    a.clientName,
    a.counselorName,
  ], search))
  filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date))

  const schedules = isCounselor(req)
    ? read('schedules.json').filter(s => s.counselorId === req.session.counselorId)
    : read('schedules.json')

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
    counselorActiveCounts,
    myStatusCounts,
    query: req.query,
    userType: req.session.userType || 'admin',
  })
})

// ── API: available slots (JSON) ───────────────────────────────────────────────
router.get('/slots', (req, res) => {
  const { counselorId, date, excludeId } = req.query
  if (!counselorId || !date) return res.json({ slots: [], error: 'missing params' })
  if (!canUseCounselor(req, counselorId)) return res.status(403).json({ slots: [], error: 'forbidden' })
  const slots = getAvailableSlots(counselorId, date, excludeId)
  res.json({ slots })
})

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const { counselorId, clientId, date, time, type, note, concern } = req.body

  if (!canUseCounselor(req, counselorId) || !canUseClient(req, clientId)) return forbidden(res)

  const counselors = read('counselors.json')
  const clients    = read('clients.json')
  const counselor  = counselors.find(c => c.id === counselorId)
  const client     = clients.find(c => c.id === clientId)

  if (!counselor || !client) return res.redirect('/admin/appointments?error=invalid')

  const appointments = read('appointments.json')
  const duration = counselor.sessionDuration || 60
  const conflict = appointments.some(a =>
    a.counselorId === counselorId &&
    a.date === date &&
    a.status !== 'cancelled' &&
    timesOverlap(toMin(a.time), a.duration || duration, toMin(time), duration)
  )
  if (conflict) return res.redirect('/admin/appointments?error=conflict')

  const maxNum = appointments.reduce((max, a) => {
    const m = String(a.id).match(/^app-(\d+)$/)
    return m ? Math.max(max, parseInt(m[1])) : max
  }, 0)

  const newAppt = {
    id:            'app-' + String(maxNum + 1).padStart(5, '0'),
    clientId,
    clientName:    client.name,
    counselorId,
    counselorName: counselor.name,
    date,
    time,
    duration,
    type:          type || 'online',
    status:        'confirmed',
    note:          note || '',
    concern:       (concern || '').trim(),
    createdAt:     new Date().toISOString().split('T')[0],
  }

  appointments.push(newAppt)
  write('appointments.json', appointments)

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
  const { counselorId, date, time, type, status, note, concern } = req.body
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
  const duration = newCounselor.sessionDuration || current.duration || 60

  if (date || time || counselorChanged) {
    const newMin = toMin(newTime)

    const conflict = data.some((a, i) =>
      i !== idx &&
      a.counselorId === requestedCounselorId &&
      a.date === newDate &&
      a.status !== 'cancelled' &&
      timesOverlap(toMin(a.time), a.duration || duration, newMin, duration)
    )
    if (conflict) return res.redirect('/admin/appointments?error=conflict')
  }

  const oldCounselor    = counselors.find(c => c.id === current.counselorId)
  const scheduleChanged = newDate !== current.date || newTime !== current.time || counselorChanged

  data[idx].counselorId   = requestedCounselorId
  data[idx].counselorName = newCounselor.name
  data[idx].duration      = duration
  data[idx].date          = newDate
  data[idx].time          = newTime
  if (scheduleChanged) data[idx].reminderSent = false
  if (!counselorRole) {
    if (type)   data[idx].type   = type
    if (status) data[idx].status = status
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

// ── EDIT COUNSELOR NOTE ───────────────────────────────────────────────────────
router.post('/:id/edit-note', (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (!canUseAppointment(req, data[idx])) return forbidden(res)
    data[idx].counselorNote = (req.body.counselorNote || '').trim()
    write('appointments.json', data)
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

router.post('/:id/complete', (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (!canUseAppointment(req, data[idx])) return forbidden(res)
    const appt = data[idx]
    appt.status = 'completed'
    if (req.body.counselorNote !== undefined) {
      appt.counselorNote = req.body.counselorNote.trim()
    }
    if (!appt.surveyToken) {
      appt.surveyToken = crypto.randomBytes(16).toString('hex')
    }
    write('appointments.json', data)

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
