const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const multer  = require('multer')
const crypto  = require('crypto')
const bcrypt  = require('bcryptjs')
const { logDeletion } = require('../../utils/audit-log')

const dataFile   = path.join(__dirname, '../../../data/counselors.json')
const uploadDir  = path.join(__dirname, '../../../public/uploads/counselors')

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())
    cb(ok ? null : new Error('รองรับเฉพาะไฟล์รูปภาพ'), ok)
  },
})

function readData()    { return JSON.parse(fs.readFileSync(dataFile, 'utf8')) }
function writeData(d)  { fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)) }
function str(v)        { return Array.isArray(v) ? (v[0] || '') : String(v || '') }
function parseArr(v)   { const s = Array.isArray(v) ? v.join(',') : (v || ''); return s.split(',').map(s => s.trim()).filter(Boolean) }
function initials(name){ const parts = str(name).trim().split(' '); return parts.map(p => p[0]).join('').toUpperCase().slice(0,2) }

function deletePhoto(photoPath) {
  if (!photoPath) return
  const abs = path.join(__dirname, '../../../public', photoPath)
  if (fs.existsSync(abs)) fs.unlinkSync(abs)
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const counselors = readData()
  const { status, search } = req.query
  let filtered = counselors
  if (status === 'pending') filtered = filtered.filter(c => !c.isApproved)
  else if (status)          filtered = filtered.filter(c => c.status === status && c.isApproved)
  if (search) filtered = filtered.filter(c => matchesSearch([
    c.name,
    c.email,
    c.phone,
    c.specialties,
    c.languages,
  ], search))

  // คำนวณค่าเฉลี่ยความพึงพอใจแต่ละนักจิตวิทยาจาก surveys.json
  const surveysFile = path.join(__dirname, '../../../data/surveys.json')
  const surveys = fs.existsSync(surveysFile) ? JSON.parse(fs.readFileSync(surveysFile, 'utf8')) : []
  const surveyStats = {}
  surveys.forEach(s => {
    if (!surveyStats[s.counselorId]) surveyStats[s.counselorId] = { sum: 0, count: 0 }
    surveyStats[s.counselorId].sum   += s.rating
    surveyStats[s.counselorId].count += 1
  })

  // นับจำนวนผู้รับบริการที่ดูแลอยู่ปัจจุบัน (distinct client ที่มีนัด pending/confirmed) ต่อนักจิตวิทยา
  const apptFile     = path.join(__dirname, '../../../data/appointments.json')
  const appointments = fs.existsSync(apptFile) ? JSON.parse(fs.readFileSync(apptFile, 'utf8')) : []
  const clientIdsByCounselor = {}
  appointments
    .filter(a => a.status === 'pending' || a.status === 'confirmed')
    .forEach(a => {
      if (!clientIdsByCounselor[a.counselorId]) clientIdsByCounselor[a.counselorId] = new Set()
      clientIdsByCounselor[a.counselorId].add(a.clientId)
    })
  const clientCounts = {}
  Object.keys(clientIdsByCounselor).forEach(cid => { clientCounts[cid] = clientIdsByCounselor[cid].size })

  res.render('admin/counselors', {
    page: 'counselors', title: 'จัดการนักจิตวิทยาให้คำปรึกษา',
    counselors: filtered, allCounselors: readData(), query: req.query, surveyStats, clientCounts,
  })
})

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/create', upload.single('photo'), async (req, res) => {
  const { username, password, name, title, email, phone, bio, specialties, languages, sessionDuration, isApproved } = req.body
  const data = readData()

  if (data.some(c => c.email === email)) {
    if (req.file) fs.unlinkSync(req.file.path)
    return res.redirect('/admin/counselors?error=duplicate_email')
  }

  const newId = 'c' + Date.now().toString().slice(-6)
  const photo = req.file ? '/uploads/counselors/' + req.file.filename : null

  const record = {
    id:              newId,
    name:            str(name).trim(),
    title:           str(title).trim(),
    email:           str(email).trim().toLowerCase(),
    phone:           str(phone).trim(),
    bio:             str(bio).trim(),
    specialties:     parseArr(specialties),
    languages:       parseArr(languages),
    sessionDuration: parseInt(str(sessionDuration)) || 60,
    rating:          0,
    reviewCount:     0,
    status:          str(isApproved) === 'true' ? 'active' : 'pending',
    isApproved:      str(isApproved) === 'true',
    avatar:          initials(name),
    photo:           photo,
    createdAt:       new Date().toISOString().split('T')[0],
  }

  const uname = str(username).trim()
  const pass  = str(password).trim()
  if (uname) {
    record.username = uname.toLowerCase()
    if (pass) record.password = await bcrypt.hash(pass, 10)
  }

  data.push(record)
  writeData(data)
  res.redirect('/admin/counselors?created=1')
})

// ── EDIT ──────────────────────────────────────────────────────────────────────
router.post('/:id/edit', upload.single('photo'), async (req, res) => {
  const { username, password, name, title, email, phone, bio, specialties, languages, sessionDuration } = req.body
  const data = readData()
  const idx  = data.findIndex(c => c.id === req.params.id)
  if (idx === -1) return res.redirect('/admin/counselors')

  let photo = data[idx].photo || null
  if (req.file) {
    deletePhoto(data[idx].photo)
    photo = '/uploads/counselors/' + req.file.filename
  }

  data[idx] = {
    ...data[idx],
    name:            str(name).trim(),
    title:           str(title).trim(),
    email:           str(email).trim().toLowerCase(),
    phone:           str(phone).trim(),
    bio:             str(bio).trim(),
    specialties:     parseArr(specialties),
    languages:       parseArr(languages),
    sessionDuration: parseInt(str(sessionDuration)) || data[idx].sessionDuration,
    avatar:          initials(name),
    photo:           photo,
  }

  const uname = str(username).trim()
  const pass  = str(password).trim()
  if (uname) data[idx].username = uname.toLowerCase()
  if (pass)  data[idx].password = await bcrypt.hash(pass, 10)

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
  const data = readData()
  const c    = data.find(x => x.id === req.params.id)
  if (c) {
    deletePhoto(c.photo)
    logDeletion({ entityType: 'counselor', entityId: c.id, entityName: c.name, reason: req.body.reason, req })
  }
  writeData(data.filter(x => x.id !== req.params.id))
  res.redirect('/admin/counselors')
})

module.exports = router
