const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '../../../data')

function read(file) { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }
function write(file, d) { fs.writeFileSync(path.join(dataDir, file), JSON.stringify(d, null, 2)) }

// Generate time slots from counselor schedule for a given date,
// excluding already-booked slots.
function getAvailableSlots(counselorId, dateStr) {
  const schedules    = read('schedules.json')
  const appointments = read('appointments.json')

  const date    = new Date(dateStr)
  const dow     = date.getDay()           // 0=Sun … 6=Sat
  const schedule = schedules.find(s => s.counselorId === counselorId && s.dayOfWeek === dow && s.isActive)
  if (!schedule) return []

  const counselor = read('counselors.json').find(c => c.id === counselorId)
  const duration  = counselor?.sessionDuration || 60

  // Parse HH:MM → total minutes
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const toStr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  const start  = toMin(schedule.startTime)
  const end    = toMin(schedule.endTime)

  // Booked slots for this counselor on this date
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
  const counselors   = read('counselors.json').filter(c => c.isApproved)
  const clients      = read('clients.json')

  const { status, type, search, counselorId } = req.query
  let filtered = appointments
  if (status)     filtered = filtered.filter(a => a.status === status)
  if (type)       filtered = filtered.filter(a => a.type === type)
  if (counselorId) filtered = filtered.filter(a => a.counselorId === counselorId)
  if (search)     filtered = filtered.filter(a =>
    a.clientName.includes(search) || a.counselorName.includes(search)
  )
  filtered = filtered.sort((a, b) => new Date(b.date) - new Date(a.date))

  const schedules = read('schedules.json')

  res.render('admin/appointments', {
    page: 'appointments',
    title: 'จัดการนัดหมาย',
    appointments: filtered,
    counselors,
    clients,
    schedules,
    query: req.query,
  })
})

// ── API: available slots (JSON) ───────────────────────────────────────────────
router.get('/slots', (req, res) => {
  const { counselorId, date } = req.query
  if (!counselorId || !date) return res.json({ slots: [], error: 'missing params' })
  const slots = getAvailableSlots(counselorId, date)
  res.json({ slots })
})

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/create', (req, res) => {
  const { counselorId, clientId, date, time, type, note } = req.body

  const counselors = read('counselors.json')
  const clients    = read('clients.json')
  const counselor  = counselors.find(c => c.id === counselorId)
  const client     = clients.find(c => c.id === clientId)

  if (!counselor || !client) return res.redirect('/admin/appointments?error=invalid')

  // Double-booking guard
  const appointments = read('appointments.json')
  const conflict = appointments.some(a =>
    a.counselorId === counselorId &&
    a.date === date &&
    a.time === time &&
    a.status !== 'cancelled'
  )
  if (conflict) return res.redirect('/admin/appointments?error=conflict')

  const newId = 'a' + (Date.now()).toString().slice(-6)
  const newAppt = {
    id:             newId,
    clientId,
    clientName:     client.name,
    counselorId,
    counselorName:  counselor.name,
    date,
    time,
    duration:       counselor.sessionDuration || 60,
    type:           type || 'online',
    status:         'confirmed',
    note:           note || '',
    createdAt:      new Date().toISOString().split('T')[0],
  }

  appointments.push(newAppt)
  write('appointments.json', appointments)
  res.redirect('/admin/appointments?created=1')
})

// ── STATUS ACTIONS ────────────────────────────────────────────────────────────
router.post('/:id/confirm', (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) { data[idx].status = 'confirmed'; write('appointments.json', data) }
  res.redirect('/admin/appointments')
})

router.post('/:id/complete', (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) { data[idx].status = 'completed'; write('appointments.json', data) }
  res.redirect('/admin/appointments')
})

router.post('/:id/cancel', (req, res) => {
  const data = read('appointments.json')
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) { data[idx].status = 'cancelled'; write('appointments.json', data) }
  res.redirect('/admin/appointments')
})

module.exports = router
