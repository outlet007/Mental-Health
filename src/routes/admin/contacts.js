const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const { sendAppointmentEmails } = require('../../utils/mailer')

const dataDir  = path.join(__dirname, '../../../data')
const dataFile = path.join(dataDir, 'contacts.json')

function readFile(file) { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }
function readData()     { return JSON.parse(fs.readFileSync(dataFile, 'utf8')) }
function writeData(d)   { fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)) }

router.get('/', (req, res) => {
  const contacts     = readData()
  const counselors   = readFile('counselors.json').filter(c => c.isApproved)
  const schedules    = readFile('schedules.json')
  const clients      = readFile('clients.json')
  const appointments = readFile('appointments.json')

  const { search } = req.query
  let filtered = contacts
  if (search) filtered = filtered.filter(c => matchesSearch([
    c.name,
    c.phone,
    c.email,
  ], search))
  filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const counselorActiveCounts = {}
  appointments.forEach(a => {
    if (a.status === 'pending' || a.status === 'confirmed') {
      counselorActiveCounts[a.counselorId] = (counselorActiveCounts[a.counselorId] || 0) + 1
    }
  })

  res.render('admin/contacts', {
    page: 'contacts', title: 'คำขอเพื่อทำนัดหมาย',
    contacts: filtered, query: req.query,
    total:        contacts.length,
    pendingCount: contacts.filter(c => ['new','contacted'].includes(c.status)).length,
    doneCount:    contacts.filter(c => ['converted','closed'].includes(c.status)).length,
    counselors, schedules, clients, counselorActiveCounts,
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

router.post('/:id/book', async (req, res) => {
  const { counselorId, date, time, type, note } = req.body
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

  // Find or create client from contact info
  const clientsFile = path.join(dataDir, 'clients.json')
  const clients = JSON.parse(fs.readFileSync(clientsFile, 'utf8'))
  let client = clients.find(c => c.phone === contact.phone || (contact.email && c.email === contact.email))
  if (!client) {
    client = {
      id: 'cl' + Date.now().toString().slice(-6),
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
    }
    clients.push(client)
    fs.writeFileSync(clientsFile, JSON.stringify(clients, null, 2))
  }

  const apptFile = path.join(dataDir, 'appointments.json')
  const appts    = JSON.parse(fs.readFileSync(apptFile, 'utf8'))
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
    type:          type || contact.sessionType || 'online',
    status:        'confirmed',
    note:          note || '',
    createdAt:     new Date().toISOString().split('T')[0],
  }
  appts.push(newAppt)
  fs.writeFileSync(apptFile, JSON.stringify(appts, null, 2))

  contacts[idx].status = 'converted'
  writeData(contacts)

  // ส่งอีเมลแจ้งทั้งสองฝ่าย (ไม่รอ — redirect ทันที)
  sendAppointmentEmails({
    appointment: newAppt,
    client:      { name: client.name, email: client.email, phone: client.phone },
    counselor:   { name: counselor.name, title: counselor.title, email: counselor.email, phone: counselor.phone, specialties: counselor.specialties },
    concern:     contact.concern || '',
  }).catch(err => console.error('[Email] unexpected error:', err.message))

  res.redirect('/admin/contacts?booked=1')
})

router.post('/:id/delete', (req, res) => {
  writeData(readData().filter(c => c.id !== req.params.id))
  res.redirect('/admin/contacts')
})

module.exports = router
