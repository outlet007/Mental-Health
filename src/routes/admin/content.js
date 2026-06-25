const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const multer  = require('multer')
const { sendAppointmentEmails } = require('../../utils/mailer')

const dataFile  = path.join(__dirname, '../../../data/content.json')
const uploadDir = path.join(__dirname, '../../../public/uploads/content')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const bgStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
})
const bgUpload = multer({ storage: bgStorage, limits: { fileSize: 5 * 1024 * 1024 } }).fields([
  { name: 'img_hero',       maxCount: 1 },
  { name: 'img_counselors', maxCount: 1 },
  { name: 'img_features',   maxCount: 1 },
  { name: 'img_book',       maxCount: 1 },
  { name: 'img_faq',        maxCount: 1 },
])

function readData()   { return JSON.parse(fs.readFileSync(dataFile, 'utf8')) }
function writeData(d) { fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)) }

const _hexRe = /^#[0-9A-Fa-f]{6}$/
function saveTextColors(data, section, fields, body) {
  if (!data.backgrounds) data.backgrounds = {}
  if (!data.backgrounds[section]) data.backgrounds[section] = { color: '', image: '' }
  const previous = data.backgrounds[section].textColors || {}
  const textColors = { ...previous }
  fields.forEach(field => {
    const v = (body[`textColor_${section}_${field}`] || '').trim()
    textColors[field] = _hexRe.test(v) ? v : ''
  })
  data.backgrounds[section].textColors = textColors
}

function clampNumber(value, fallback, min, max) {
  const n = parseFloat(value)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

router.get('/', (req, res) => {
  const content = readData()
  if (!content.en) content.en = {}
  res.render('admin/content', {
    page: 'content', title: 'จัดการเนื้อหาเว็บไซต์',
    content, query: req.query,
  })
})

// ── TH endpoints ─────────────────────────────────────────────────────────────
router.post('/hero', (req, res) => {
  const data = readData()
  data.hero = {
    badge:    (req.body.badge    || '').trim(),
    heading1: (req.body.heading1 || '').trim(),
    heading2: (req.body.heading2 || '').trim(),
    subtext:  (req.body.subtext  || '').trim(),
    ctaMain:  (req.body.ctaMain  || '').trim(),
    ctaSub:   (req.body.ctaSub   || '').trim(),
  }
  saveTextColors(data, 'hero', ['heading', 'subtext'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=hero')
})

router.post('/sections', (req, res) => {
  const data = readData()
  data.counselors = {
    heading: (req.body.counselorsHeading || '').trim(),
    subtext: (req.body.counselorsSubtext || '').trim(),
  }
  data.book = {
    heading:     (req.body.bookHeading     || '').trim(),
    subtext:     (req.body.bookSubtext     || '').trim(),
    formHeading: (req.body.bookFormHeading || '').trim(),
  }
  saveTextColors(data, 'counselors', ['heading', 'subtext'], req.body)
  saveTextColors(data, 'book', ['heading', 'subtext', 'formHeading'], req.body)
  data.contact = {
    email: (req.body.contactEmail || '').trim(),
    phone: (req.body.contactPhone || '').trim(),
    hours: (req.body.contactHours || '').trim(),
  }
  writeData(data)
  res.redirect('/admin/content?saved=sections')
})

router.post('/faqs', (req, res) => {
  const data = readData()
  const qs = [].concat(req.body.faq_q || [])
  const as = [].concat(req.body.faq_a || [])
  data.faqs = qs
    .map((q, i) => ({ q: q.trim(), a: (as[i] || '').trim() }))
    .filter(f => f.q)
  saveTextColors(data, 'faq', ['heading', 'questions', 'answers'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=faqs')
})

// ── EN endpoints ──────────────────────────────────────────────────────────────
router.post('/hero-en', (req, res) => {
  const data = readData()
  if (!data.en) data.en = {}
  data.en.hero = {
    badge:    (req.body.badge    || '').trim(),
    heading1: (req.body.heading1 || '').trim(),
    heading2: (req.body.heading2 || '').trim(),
    subtext:  (req.body.subtext  || '').trim(),
    ctaMain:  (req.body.ctaMain  || '').trim(),
    ctaSub:   (req.body.ctaSub   || '').trim(),
  }
  saveTextColors(data, 'hero', ['heading', 'subtext'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=hero-en')
})

router.post('/sections-en', (req, res) => {
  const data = readData()
  if (!data.en) data.en = {}
  data.en.counselors = {
    heading: (req.body.counselorsHeading || '').trim(),
    subtext: (req.body.counselorsSubtext || '').trim(),
  }
  data.en.book = {
    heading:     (req.body.bookHeading     || '').trim(),
    subtext:     (req.body.bookSubtext     || '').trim(),
    formHeading: (req.body.bookFormHeading || '').trim(),
  }
  saveTextColors(data, 'counselors', ['heading', 'subtext'], req.body)
  saveTextColors(data, 'book', ['heading', 'subtext', 'formHeading'], req.body)
  data.en.contact = {
    email: (req.body.contactEmail || '').trim(),
    phone: (req.body.contactPhone || '').trim(),
    hours: (req.body.contactHours || '').trim(),
  }
  writeData(data)
  res.redirect('/admin/content?saved=sections-en')
})

router.post('/faqs-en', (req, res) => {
  const data = readData()
  if (!data.en) data.en = {}
  const qs = [].concat(req.body.faq_q || [])
  const as = [].concat(req.body.faq_a || [])
  data.en.faqs = qs
    .map((q, i) => ({ q: q.trim(), a: (as[i] || '').trim() }))
    .filter(f => f.q)
  saveTextColors(data, 'faq', ['heading', 'questions', 'answers'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=faqs-en')
})

// ── Section backgrounds ───────────────────────────────────────────────────────
const _tcFields = {
  hero:       ['heading', 'subtext'],
  counselors: ['heading', 'subtext'],
  features:   ['heading', 'subtext'],
  book:       ['heading', 'subtext', 'formHeading'],
  faq:        ['heading', 'questions', 'answers'],
}

router.post('/backgrounds', bgUpload, (req, res) => {
  const data = readData()
  if (!data.backgrounds) data.backgrounds = {}
  const files = req.files || {}
  ;['hero', 'counselors', 'features', 'book', 'faq'].forEach(sec => {
    if (!data.backgrounds[sec]) data.backgrounds[sec] = { color: '', image: '' }
    data.backgrounds[sec].color = (req.body['color_' + sec] || '').trim()
    const op = parseFloat(req.body['opacity_' + sec])
    data.backgrounds[sec].opacity = isNaN(op) ? 1 : Math.min(1, Math.max(0, op))
    const imgOp = parseFloat(req.body['imgOpacity_' + sec])
    data.backgrounds[sec].imgOpacity = isNaN(imgOp) ? 1 : Math.min(1, Math.max(0, imgOp))
    data.backgrounds[sec].motionEnabled = req.body['motionEnabled_' + sec] !== 'off'
    data.backgrounds[sec].motionDuration = clampNumber(req.body['motionDuration_' + sec], 38, 8, 90)
    data.backgrounds[sec].motionScale = clampNumber(req.body['motionScale_' + sec], 1.12, 1, 1.35)
    const hexRe = /^#[0-9A-Fa-f]{6}$/
    const textColors = {}
    ;(_tcFields[sec] || []).forEach(field => {
      const v = (req.body[`textColor_${sec}_${field}`] || '').trim()
      textColors[field] = hexRe.test(v) ? v : ''
    })
    data.backgrounds[sec].textColors = textColors
    if (files['img_' + sec] && files['img_' + sec][0]) {
      data.backgrounds[sec].image = '/uploads/content/' + files['img_' + sec][0].filename
    }
    if (req.body['clear_' + sec]) {
      data.backgrounds[sec].image = ''
    }
  })
  writeData(data)
  res.redirect('/admin/content?saved=backgrounds')
})

// ── Test email ────────────────────────────────────────────────────────────────
router.post('/test-email', async (req, res) => {
  const to = (req.body.to || '').trim()
  if (!to) return res.redirect('/admin/content?emailError=missing')

  const mockAppt = {
    id: 'test001',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 60,
    type: 'online',
    note: 'นัดทดสอบระบบอีเมล',
    status: 'confirmed',
    createdAt: new Date().toISOString().split('T')[0],
  }
  try {
    await sendAppointmentEmails({
      appointment: mockAppt,
      client:    { name: 'ผู้รับบริการทดสอบ', email: to, phone: '08X-XXX-XXXX' },
      counselor: { name: 'ดร.ทดสอบ ระบบอีเมล', title: 'นักจิตวิทยาให้คำปรึกษา', email: to, phone: '08X-XXX-XXXX', specialties: ['ทดสอบระบบ'] },
      concern:   'ทดสอบการส่งอีเมลจากระบบ MindCare',
    })
    res.redirect('/admin/content?emailSent=1')
  } catch (err) {
    console.error('[Email test]', err.message)
    res.redirect('/admin/content?emailError=' + encodeURIComponent(err.message))
  }
})

module.exports = router
