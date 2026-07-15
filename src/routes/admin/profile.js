const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const multer  = require('multer')
const crypto  = require('crypto')
const bcrypt  = require('bcryptjs')
const { ensureToken, verifyToken } = require('../../middleware/csrf')
const { readJSON, writeJSON } = require('../../utils/json-store')
router.use(ensureToken)
router.use(verifyToken)

const dataFile  = path.join(__dirname, '../../../data/counselors.json')
const uploadDir = path.join(__dirname, '../../../public/uploads/counselors')

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
    cb(ok ? null : new Error('invalid image file'), ok)
  },
})

function readData() { return readJSON(dataFile) }
function writeData(data) { writeJSON(dataFile, data) }
function str(v) { return Array.isArray(v) ? (v[0] || '') : String(v || '') }
function parseArr(v) {
  const raw = Array.isArray(v) ? v.join(',') : (v || '')
  return raw.split(',').map(item => item.trim()).filter(Boolean)
}
function initials(name) {
  const parts = str(name).trim().split(' ').filter(Boolean)
  return parts.map(part => part[0]).join('').toUpperCase().slice(0, 2)
}
function deletePhoto(photoPath) {
  if (!photoPath) return
  const abs = path.join(__dirname, '../../../public', photoPath)
  if (fs.existsSync(abs)) fs.unlinkSync(abs)
}
function requireCounselor(req, res, next) {
  if (!req.session || req.session.userType !== 'counselor' || !req.session.counselorId) {
    return res.redirect('/admin')
  }
  next()
}
function findCurrentCounselor(req) {
  const data = readData()
  const idx = data.findIndex(c => c.id === req.session.counselorId)
  return { data, idx, counselor: idx === -1 ? null : data[idx] }
}
function syncSession(req, counselor) {
  req.session.adminName = counselor.name || req.session.adminName
  req.session.adminEmail = counselor.email || req.session.adminEmail
  req.session.adminPhoto = counselor.photo || ''
  req.session.adminAvatar = counselor.avatar || ''
}

router.get('/', requireCounselor, (req, res) => {
  const { counselor } = findCurrentCounselor(req)
  if (!counselor) return res.redirect('/admin')

  res.render('admin/profile', {
    page: 'profile',
    title: 'จัดการข้อมูลผู้ใช้',
    counselor,
    query: req.query,
  })
})

router.post('/', requireCounselor, upload.single('photo'), verifyToken, async (req, res) => {
  const { name, title, email, phone, bio, specialties, languages, sessionDuration, password } = req.body
  // Hash before reading the file: bcrypt.hash awaits (yields to the event
  // loop), so a read-then-await-then-write here could interleave with another
  // concurrent request's write and silently lose one of the two updates.
  const newPassword = str(password).trim()
  const hashedPassword = newPassword ? await bcrypt.hash(newPassword, 10) : null

  const { data, idx } = findCurrentCounselor(req)
  if (idx === -1) {
    if (req.file) fs.unlinkSync(req.file.path)
    return res.redirect('/admin')
  }

  let photo = data[idx].photo || null
  if (req.file) {
    deletePhoto(data[idx].photo)
    photo = '/uploads/counselors/' + req.file.filename
  }

  data[idx] = {
    ...data[idx],
    name: str(name).trim(),
    title: str(title).trim(),
    email: str(email).trim().toLowerCase(),
    phone: str(phone).trim(),
    bio: str(bio).trim(),
    specialties: parseArr(specialties),
    languages: parseArr(languages),
    sessionDuration: parseInt(str(sessionDuration), 10) || data[idx].sessionDuration,
    avatar: initials(name),
    photo,
  }

  if (hashedPassword) data[idx].password = hashedPassword

  writeData(data)
  syncSession(req, data[idx])
  res.redirect('/admin/profile?updated=1')
})

module.exports = router
