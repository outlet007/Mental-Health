const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')

const dataFile = path.join(__dirname, '../../../data/counselors.json')

function readData()    { return JSON.parse(fs.readFileSync(dataFile, 'utf8')) }
function writeData(d)  { fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)) }
function parseArr(str) { return (str || '').split(',').map(s => s.trim()).filter(Boolean) }
function initials(name){ const parts = name.trim().split(' '); return parts.map(p => p[0]).join('').toUpperCase().slice(0,2) }

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const counselors = readData()
  const { status, search } = req.query
  let filtered = counselors
  if (status === 'pending') filtered = filtered.filter(c => !c.isApproved)
  else if (status)          filtered = filtered.filter(c => c.status === status && c.isApproved)
  if (search) filtered = filtered.filter(c =>
    c.name.includes(search) || c.email.includes(search) || c.specialties.some(s => s.includes(search))
  )
  res.render('admin/counselors', {
    page: 'counselors', title: 'จัดการนักให้คำปรึกษา',
    counselors: filtered, allCounselors: readData(), query: req.query,
  })
})

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/create', (req, res) => {
  const { name, title, email, phone, bio, specialties, languages, fee, sessionDuration, isApproved } = req.body
  const data = readData()

  if (data.some(c => c.email === email)) return res.redirect('/admin/counselors?error=duplicate_email')

  const newId = 'c' + Date.now().toString().slice(-6)
  data.push({
    id:              newId,
    name:            name.trim(),
    title:           title.trim(),
    email:           email.trim().toLowerCase(),
    phone:           phone.trim(),
    bio:             (bio || '').trim(),
    specialties:     parseArr(specialties),
    languages:       parseArr(languages),
    fee:             parseInt(fee) || 0,
    sessionDuration: parseInt(sessionDuration) || 60,
    rating:          0,
    reviewCount:     0,
    status:          isApproved === 'true' ? 'active' : 'pending',
    isApproved:      isApproved === 'true',
    avatar:          initials(name),
    createdAt:       new Date().toISOString().split('T')[0],
  })
  writeData(data)
  res.redirect('/admin/counselors?created=1')
})

// ── EDIT ──────────────────────────────────────────────────────────────────────
router.post('/:id/edit', (req, res) => {
  const { name, title, email, phone, bio, specialties, languages, fee, sessionDuration } = req.body
  const data = readData()
  const idx  = data.findIndex(c => c.id === req.params.id)
  if (idx === -1) return res.redirect('/admin/counselors')

  data[idx] = {
    ...data[idx],
    name:            name.trim(),
    title:           title.trim(),
    email:           email.trim().toLowerCase(),
    phone:           phone.trim(),
    bio:             (bio || '').trim(),
    specialties:     parseArr(specialties),
    languages:       parseArr(languages),
    fee:             parseInt(fee) || data[idx].fee,
    sessionDuration: parseInt(sessionDuration) || data[idx].sessionDuration,
    avatar:          initials(name),
  }
  writeData(data)
  res.redirect('/admin/counselors?updated=1')
})

// ── APPROVE ───────────────────────────────────────────────────────────────────
router.post('/:id/approve', (req, res) => {
  const data = readData()
  const idx  = data.findIndex(c => c.id === req.params.id)
  if (idx !== -1) { data[idx].isApproved = true; data[idx].status = 'active'; writeData(data) }
  res.redirect('/admin/counselors')
})

// ── TOGGLE STATUS ─────────────────────────────────────────────────────────────
router.post('/:id/toggle-status', (req, res) => {
  const data = readData()
  const idx  = data.findIndex(c => c.id === req.params.id)
  if (idx !== -1) {
    data[idx].status = data[idx].status === 'active' ? 'inactive' : 'active'
    writeData(data)
  }
  res.redirect('/admin/counselors')
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/:id/delete', (req, res) => {
  writeData(readData().filter(c => c.id !== req.params.id))
  res.redirect('/admin/counselors')
})

module.exports = router
