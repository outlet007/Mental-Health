const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const multer  = require('multer')
const bcrypt  = require('bcryptjs')

const dataFile   = path.join(__dirname, '../../../data/counselors.json')
const uploadDir  = path.join(__dirname, '../../../public/uploads/counselors')

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, Date.now() + ext)
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
function parseArr(str) { return (str || '').split(',').map(s => s.trim()).filter(Boolean) }
function initials(name){ const parts = name.trim().split(' '); return parts.map(p => p[0]).join('').toUpperCase().slice(0,2) }

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
  if (search) filtered = filtered.filter(c =>
    c.name.includes(search) || c.email.includes(search) || c.specialties.some(s => s.includes(search))
  )
  res.render('admin/counselors', {
    page: 'counselors', title: 'จัดการนักให้คำปรึกษา',
    counselors: filtered, allCounselors: readData(), query: req.query,
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
    name:            name.trim(),
    title:           title.trim(),
    email:           email.trim().toLowerCase(),
    phone:           phone.trim(),
    bio:             (bio || '').trim(),
    specialties:     parseArr(specialties),
    languages:       parseArr(languages),
    sessionDuration: parseInt(sessionDuration) || 60,
    rating:          0,
    reviewCount:     0,
    status:          isApproved === 'true' ? 'active' : 'pending',
    isApproved:      isApproved === 'true',
    avatar:          initials(name),
    photo:           photo,
    createdAt:       new Date().toISOString().split('T')[0],
  }

  if (username && username.trim()) {
    record.username = username.trim().toLowerCase()
    if (password && password.trim()) {
      record.password = await bcrypt.hash(password.trim(), 10)
    }
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
    name:            name.trim(),
    title:           title.trim(),
    email:           email.trim().toLowerCase(),
    phone:           phone.trim(),
    bio:             (bio || '').trim(),
    specialties:     parseArr(specialties),
    languages:       parseArr(languages),
    sessionDuration: parseInt(sessionDuration) || data[idx].sessionDuration,
    avatar:          initials(name),
    photo:           photo,
  }

  if (username && username.trim()) data[idx].username = username.trim().toLowerCase()
  if (password && password.trim()) data[idx].password = await bcrypt.hash(password.trim(), 10)

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
  if (c) deletePhoto(c.photo)
  writeData(data.filter(x => x.id !== req.params.id))
  res.redirect('/admin/counselors')
})

module.exports = router
