const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const { sendAppointmentEmails, sendCounselorReassignedEmail } = require('../../utils/mailer')
const { reassignAppointmentCounselor } = require('../../utils/appointment-scheduling')

const dataDir    = path.join(__dirname, '../../../data')
const clientFile = path.join(dataDir, 'clients.json')
const apptFile   = path.join(dataDir, 'appointments.json')

function read(file)    { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }
function write(file, d) { fs.writeFileSync(path.join(dataDir, file), JSON.stringify(d, null, 2)) }
function readClients()  { return JSON.parse(fs.readFileSync(clientFile, 'utf8')) }
function writeClients(d){ fs.writeFileSync(clientFile, JSON.stringify(d, null, 2)) }

function isCounselor(req) {
  return req.session.userType === 'counselor'
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
  const clients      = readClients()
  let appointments   = read('appointments.json')
  let counselors     = read('counselors.json').filter(c => c.isApproved)
  let schedules      = read('schedules.json')

  const { status, search } = req.query
  let filtered = clients

  // Counselors only see clients who have appointments with them
  if (isCounselor(req)) {
    appointments = appointments.filter(a => a.counselorId === req.session.counselorId)
    counselors   = counselors.filter(c => c.id === req.session.counselorId)
    schedules    = schedules.filter(s => s.counselorId === req.session.counselorId)

    const myClientIds = new Set(
      appointments.map(a => a.clientId)
    )
    filtered = filtered.filter(c => myClientIds.has(c.id))
  }

  const clientStats = {
    total:    filtered.length,
    active:   filtered.filter(c => c.status === 'active').length,
    inactive: filtered.filter(c => c.status === 'inactive').length,
  }

  if (status) filtered = filtered.filter(c => c.status === status)
  if (search) filtered = filtered.filter(c => matchesSearch([
    c.name,
    c.email,
    c.phone,
    c.studentId,
  ], search))

  const counselorActiveCounts = {}
  appointments.forEach(a => {
    if (a.status === 'pending' || a.status === 'confirmed') {
      counselorActiveCounts[a.counselorId] = (counselorActiveCounts[a.counselorId] || 0) + 1
    }
  })

  res.render('admin/clients', {
    page: 'clients', title: 'ข้อมูลผู้รับบริการ',
    clients: filtered, query: req.query,
    appointments, counselors, schedules, counselorActiveCounts, clientStats,
  })
})

// ── DETAIL ────────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const clients      = readClients()
  const appointments = JSON.parse(fs.readFileSync(apptFile, 'utf8'))
  const client       = clients.find(c => c.id === req.params.id)
  if (!client) return res.redirect('/admin/clients')
  if (!canUseClient(req, req.params.id)) return forbidden(res)
  const clientAppointments = appointments
    .filter(a =>
      a.clientId === req.params.id &&
      (!isCounselor(req) || a.counselorId === req.session.counselorId)
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  res.render('admin/client-detail', {
    page: 'clients', title: `ข้อมูล ${client.name}`,
    client, appointments: clientAppointments,
  })
})

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/create', (req, res) => {
  if (isCounselor(req)) return forbidden(res)

  const { name, email, phone, age, gender, status, studentId } = req.body
  const clients = readClients()

  if (clients.some(c => c.email === email.trim().toLowerCase())) {
    return res.redirect('/admin/clients?error=duplicate_email')
  }

  const newId = 'u' + Date.now().toString().slice(-6)
  clients.push({
    id:            newId,
    name:          name.trim(),
    studentId:     (studentId || '').trim(),
    email:         email.trim().toLowerCase(),
    phone:         phone.trim(),
    age:           parseInt(age) || 0,
    gender:        gender || 'unspecified',
    registeredAt:  new Date().toISOString().split('T')[0],
    totalSessions: 0,
    status:        status || 'active',
    lastSession:   null,
  })
  writeClients(clients)
  res.redirect('/admin/clients?created=1')
})

// ── EDIT ──────────────────────────────────────────────────────────────────────
router.post('/:id/edit', (req, res) => {
  const { name, email, phone, age, gender, status, studentId } = req.body
  const clients = readClients()
  const idx     = clients.findIndex(c => c.id === req.params.id)
  if (idx === -1) return res.redirect('/admin/clients')
  if (!canUseClient(req, req.params.id)) return forbidden(res)

  clients[idx] = {
    ...clients[idx],
    name:      name.trim(),
    studentId: (studentId || '').trim(),
    email:     email.trim().toLowerCase(),
    phone:     phone.trim(),
    age:       parseInt(age) || clients[idx].age,
    gender:    gender || clients[idx].gender,
    status:    status || clients[idx].status,
  }
  writeClients(clients)
  res.redirect('/admin/clients?updated=1')
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/:id/delete', (req, res) => {
  if (!canUseClient(req, req.params.id)) return forbidden(res)
  writeClients(readClients().filter(c => c.id !== req.params.id))
  res.redirect('/admin/clients?deleted=1')
})

// ── TRANSFER (reassign counselor per appointment) ──────────────────────────────
router.post('/:id/transfer', (req, res) => {
  if (isCounselor(req)) return forbidden(res)

  const client = readClients().find(c => c.id === req.params.id)
  if (!client) return res.redirect('/admin/clients')

  const appointmentIds  = [].concat(req.body.appointmentId || [])
  const newCounselorIds = [].concat(req.body.counselorId || [])

  const data       = read('appointments.json')
  const counselors = read('counselors.json')

  let movedCount    = 0
  let conflictCount = 0
  const notifications = []

  appointmentIds.forEach((apptId, i) => {
    const newCounselorId = newCounselorIds[i]
    if (!newCounselorId) return

    const idx = data.findIndex(a => a.id === apptId && a.clientId === req.params.id)
    if (idx === -1) return
    if (!['pending', 'confirmed'].includes(data[idx].status)) return

    const beforeSnapshot = { ...data[idx] }
    const result = reassignAppointmentCounselor(data, idx, newCounselorId, counselors)

    if (!result.ok) {
      if (result.error === 'conflict') conflictCount++
      return
    }
    if (!result.changed) return

    movedCount++
    notifications.push({
      confirmAppointment: { ...data[idx] },
      cancelAppointment:  beforeSnapshot,
      oldCounselor:        result.oldCounselor,
      newCounselor:        result.newCounselor,
    })
  })

  write('appointments.json', data)

  notifications.forEach(({ confirmAppointment, cancelAppointment, oldCounselor, newCounselor }) => {
    sendAppointmentEmails({
      appointment: confirmAppointment,
      client:      { name: client.name, email: client.email || '', phone: client.phone || '' },
      counselor:   { name: newCounselor.name, title: newCounselor.title, email: newCounselor.email, phone: newCounselor.phone, specialties: newCounselor.specialties },
      concern:     '',
    }).catch(err => console.error('[Email] unexpected error:', err.message))

    if (oldCounselor) {
      sendCounselorReassignedEmail({
        appointment: cancelAppointment,
        client:      { name: client.name },
        counselor:   { name: oldCounselor.name, email: oldCounselor.email },
      }).catch(err => console.error('[Email] unexpected error:', err.message))
    }
  })

  res.redirect(`/admin/clients?transferred=${movedCount}&transferConflict=${conflictCount}`)
})

module.exports = router
