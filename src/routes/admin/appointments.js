const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const crypto = require('crypto')
const { sendAppointmentEmails, sendSurveyEmail } = require('../../utils/mailer')

const dataDir = path.join(__dirname, '../../../data')

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
function getAvailableSlots(counselorId, dateStr) {
  const schedules    = read('schedules.json')
  const appointments = read('appointments.json')

  const date     = new Date(dateStr)
  const dow      = date.getDay()
  const schedule = schedules.find(s => s.counselorId === counselorId && s.dayOfWeek === dow && s.isActive)
  if (!schedule) return []

  const counselor = read('counselors.json').find(c => c.id === counselorId)
  const duration  = counselor?.sessionDuration || 60

  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const toStr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  const start = toMin(schedule.startTime)
  const end   = toMin(schedule.endTime)

  const bookedTimes = appointments
    .filter(a => a.counselorId === counselorId && a.date === dateStr && a.status !== 'cancelled')
    .map(a => toMin(a.time))

  const slots = []
  for (let t = start; t + duration <= end; t += duration) {
    const conflict = bookedTimes.some(bt => Math.abs(bt - t) < duration)
    slots.push({ time: toStr(t), available: !conflict })
  }
  return slots
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const appointments = read('appointments.json')
  let counselors     = read('counselors.json').filter(c => c.isApproved)
  let clients        = read('clients.json')

  const { status, type, search, counselorId } = req.query
  let filtered = appointments

  // Counselors see only their own appointments and clients
  if (isCounselor(req)) {
    filtered   = filtered.filter(a => a.counselorId === req.session.counselorId)
    counselors = counselors.filter(c => c.id === req.session.counselorId)
    const myClientIds = new Set(filtered.map(a => a.clientId))
    clients = clients.filter(c => myClientIds.has(c.id))
  } else {
    if (counselorId) filtered = filtered.filter(a => a.counselorId === counselorId)
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

  res.render('admin/appointments', {
    page: 'appointments',
    title: 'จัดการนัดหมาย',
    appointments: filtered,
    counselors,
    clients,
    schedules,
    query: req.query,
    userType: req.session.userType || 'admin',
  })
})

// ── API: available slots (JSON) ───────────────────────────────────────────────
router.get('/slots', (req, res) => {
  const { counselorId, date } = req.query
  if (!counselorId || !date) return res.json({ slots: [], error: 'missing params' })
  if (!canUseCounselor(req, counselorId)) return res.status(403).json({ slots: [], error: 'forbidden' })
  const slots = getAvailableSlots(counselorId, date)
  res.json({ slots })
})

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const { counselorId, clientId, date, time, type, note } = req.body

  if (!canUseCounselor(req, counselorId) || !canUseClient(req, clientId)) return forbidden(res)

  const counselors = read('counselors.json')
  const clients    = read('clients.json')
  const counselor  = counselors.find(c => c.id === counselorId)
  const client     = clients.find(c => c.id === clientId)

  if (!counselor || !client) return res.redirect('/admin/appointments?error=invalid')

  const appointments = read('appointments.json')
  const conflict = appointments.some(a =>
    a.counselorId === counselorId &&
    a.date === date &&
    a.time === time &&
    a.status !== 'cancelled'
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
    duration:      counselor.sessionDuration || 60,
    type:          type || 'online',
    status:        'confirmed',
    note:          note || '',
    createdAt:     new Date().toISOString().split('T')[0],
  }

  appointments.push(newAppt)
  write('appointments.json', appointments)

  sendAppointmentEmails({
    appointment: newAppt,
    client:      { name: client.name, email: client.email || '', phone: client.phone || '' },
    counselor:   { name: counselor.name, title: counselor.title, email: counselor.email, phone: counselor.phone, specialties: counselor.specialties },
    concern:     '',
  }).catch(err => console.error('[Email] unexpected error:', err.message))

  res.redirect('/admin/appointments?created=1')
})

// ── EDIT ──────────────────────────────────────────────────────────────────────
router.post('/:id/edit', (req, res) => {
  const { date, time, type, status, note } = req.body
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (!canUseAppointment(req, data[idx])) return forbidden(res)
    if (date)   data[idx].date   = date
    if (time)   data[idx].time   = time
    if (type)   data[idx].type   = type
    if (status) data[idx].status = status
    if (note !== undefined) data[idx].note = note.trim()
    write('appointments.json', data)
  }
  res.redirect('/admin/appointments?updated=1')
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/:id/delete', (req, res) => {
  const data = read('appointments.json')
  const appt = data.find(a => a.id === req.params.id)
  if (appt && !canUseAppointment(req, appt)) return forbidden(res)
  write('appointments.json', data.filter(a => a.id !== req.params.id))
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
      sendSurveyEmail({
        appointment: appt,
        client,
        counselor,
        surveyUrl: `${baseUrl}/survey/${appt.surveyToken}`,
      }).catch(err => console.error('[Email] survey error:', err.message))
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
