const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')

const clientFile = path.join(__dirname, '../../../data/clients.json')
const apptFile   = path.join(__dirname, '../../../data/appointments.json')

function readClients()  { return JSON.parse(fs.readFileSync(clientFile, 'utf8')) }
function writeClients(d){ fs.writeFileSync(clientFile, JSON.stringify(d, null, 2)) }

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const clients = readClients()
  const { status, search } = req.query
  let filtered = clients
  if (status) filtered = filtered.filter(c => c.status === status)
  if (search) filtered = filtered.filter(c =>
    c.name.includes(search) || c.email.includes(search) || c.phone.includes(search)
  )
  res.render('admin/clients', {
    page: 'clients', title: 'ข้อมูลผู้รับบริการ',
    clients: filtered, query: req.query,
  })
})

// ── DETAIL ────────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const clients      = readClients()
  const appointments = JSON.parse(fs.readFileSync(apptFile, 'utf8'))
  const client       = clients.find(c => c.id === req.params.id)
  if (!client) return res.redirect('/admin/clients')
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
  const { name, email, phone, age, gender, status } = req.body
  const clients = readClients()

  if (clients.some(c => c.email === email.trim().toLowerCase())) {
    return res.redirect('/admin/clients?error=duplicate_email')
  }

  const newId = 'u' + Date.now().toString().slice(-6)
  clients.push({
    id:            newId,
    name:          name.trim(),
    email:         email.trim().toLowerCase(),
    phone:         phone.trim(),
    age:           parseInt(age) || 0,
    gender:        gender || 'ไม่ระบุ',
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
  const { name, email, phone, age, gender, status } = req.body
  const clients = readClients()
  const idx     = clients.findIndex(c => c.id === req.params.id)
  if (idx === -1) return res.redirect('/admin/clients')

  clients[idx] = {
    ...clients[idx],
    name:   name.trim(),
    email:  email.trim().toLowerCase(),
    phone:  phone.trim(),
    age:    parseInt(age) || clients[idx].age,
    gender: gender || clients[idx].gender,
    status: status || clients[idx].status,
  }
  writeClients(clients)
  res.redirect('/admin/clients?updated=1')
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/:id/delete', (req, res) => {
  writeClients(readClients().filter(c => c.id !== req.params.id))
  res.redirect('/admin/clients?deleted=1')
})

module.exports = router
