const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const { sendAppointmentEmails, sendCounselorReassignedEmail } = require('../../utils/mailer')
const { resolveAppointmentEmailOptions, resolveReassignedEmailOptions } = require('../../utils/survey-email-settings')
const { reassignAppointmentCounselor } = require('../../utils/appointment-scheduling')
const { logDeletion } = require('../../utils/audit-log')
const { getConcernOptions } = require('../../utils/concern-options')

const dataDir    = path.join(__dirname, '../../../data')
const clientFile = path.join(dataDir, 'clients.json')
const apptFile   = path.join(dataDir, 'appointments.json')

// สีอ้างอิงต่อนักจิตวิทยา — ต้องตรงกับ COLORS ใน src/routes/admin/schedules.js
const COUNSELOR_COLORS = ['#6366f1','#05967e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#10b981','#f43f5e']

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

  // สีต่อนักจิตวิทยา อ้างอิงลำดับเดียวกับตารางเวลา (มุมมอง admin) เพื่อให้สีตรงกันทั้งระบบ
  const counselorColors = {}
  counselors.forEach((c, i) => { counselorColors[c.id] = COUNSELOR_COLORS[i % COUNSELOR_COLORS.length] })

  // ผู้รับบริการที่รอโอนย้าย: มีนัดหมายรอยืนยัน/ยืนยันแล้วผูกกับนักจิตวิทยาที่ถูกระงับ/ลาออก (status inactive)
  const inactiveCounselorIds = new Set(
    read('counselors.json').filter(c => c.status === 'inactive').map(c => c.id)
  )
  const pendingTransferClientIds = new Set(
    appointments
      .filter(a => (a.status === 'pending' || a.status === 'confirmed') && inactiveCounselorIds.has(a.counselorId))
      .map(a => a.clientId)
  )

  const { status, search } = req.query
  let filtered = clients

  // Counselors only see clients who have appointments with them
  if (isCounselor(req)) {
    const myAppointments = appointments.filter(a => a.counselorId === req.session.counselorId)
    counselors = counselors.filter(c => c.id === req.session.counselorId)
    schedules  = schedules.filter(s => s.counselorId === req.session.counselorId)

    const myClientIds = new Set(myAppointments.map(a => a.clientId))
    filtered = filtered.filter(c => myClientIds.has(c.id))

    // ส่งประวัตินัดหมายทั้งหมดของผู้รับบริการเหล่านี้ (ไม่ใช่แค่ของตัวเอง) ไปที่ modal
    // ประวัติการนัดหมาย เพื่อให้เห็นประวัติต่อเนื่องเมื่อมีการโอนย้ายมาจากนักจิตวิทยาคนอื่น
    appointments = appointments.filter(a => myClientIds.has(a.clientId))
  }

  const clientStats = {
    total:           filtered.length,
    active:          filtered.filter(c => c.status === 'active').length,
    inactive:        filtered.filter(c => c.status === 'inactive').length,
    pendingTransfer: filtered.filter(c => pendingTransferClientIds.has(c.id)).length,
  }

  if (status === 'pending_transfer') filtered = filtered.filter(c => pendingTransferClientIds.has(c.id))
  else if (status)                   filtered = filtered.filter(c => c.status === status)
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
    appointments, counselors, schedules, counselorActiveCounts, clientStats, counselorColors,
    pendingTransferClientIds: [...pendingTransferClientIds],
    concernOptions: getConcernOptions(),
  })
})

// ── DETAIL ────────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const clients      = readClients()
  const appointments = JSON.parse(fs.readFileSync(apptFile, 'utf8'))
  const client       = clients.find(c => c.id === req.params.id)
  if (!client) return res.redirect('/admin/clients')
  if (!canUseClient(req, req.params.id)) return forbidden(res)
  // นักจิตวิทยาที่เข้าถึงหน้านี้ได้ (ผ่าน canUseClient) ต้องเห็นประวัตินัดหมายทั้งหมด
  // ของผู้รับบริการ รวมถึงนัดหมายกับนักจิตวิทยาคนก่อนหน้า เพื่อติดตามอาการต่อเนื่อง
  const clientAppointments = appointments
    .filter(a => a.clientId === req.params.id)
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
  const clients = readClients()
  const client  = clients.find(c => c.id === req.params.id)
  writeClients(clients.filter(c => c.id !== req.params.id))
  if (client) {
    logDeletion({ entityType: 'client', entityId: client.id, entityName: client.name, reason: req.body.reason, req })
  }
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
    const emailOptions = resolveAppointmentEmailOptions(
      { name: client.name, email: client.email || '', phone: client.phone || '' },
      { name: newCounselor.name, title: newCounselor.title, email: newCounselor.email, phone: newCounselor.phone, specialties: newCounselor.specialties }
    )
    sendAppointmentEmails({
      appointment: confirmAppointment,
      concern:     '',
      ...emailOptions,
    }).catch(err => console.error('[Email] unexpected error:', err.message))

    if (oldCounselor) {
      const reassignedOptions = resolveReassignedEmailOptions({ name: oldCounselor.name, email: oldCounselor.email })
      if (!reassignedOptions.skip) {
        sendCounselorReassignedEmail({
          appointment: cancelAppointment,
          client:      { name: client.name },
          counselor:   reassignedOptions.counselor,
          deliveryConfig: reassignedOptions.deliveryConfig,
        }).catch(err => console.error('[Email] unexpected error:', err.message))
      }
    }
  })

  res.redirect(`/admin/clients?transferred=${movedCount}&transferConflict=${conflictCount}`)
})

module.exports = router
