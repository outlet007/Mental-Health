const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const multer  = require('multer')
const crypto  = require('crypto')

const dataFile  = path.join(__dirname, '../../../data/content.json')
const uploadDir = path.join(__dirname, '../../../public/uploads/content')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

// Date.now() alone collides when multer processes several files from the same
// multipart request (e.g. saving all 3 branding images at once) fast enough
// to land in the same millisecond — same filename means the later file
// silently overwrites the earlier one on disk. The random suffix guarantees
// uniqueness regardless of how many files arrive in the same tick.
const bgStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname)),
})
const bgUpload = multer({ storage: bgStorage, limits: { fileSize: 5 * 1024 * 1024 } }).fields([
  { name: 'img_hero',       maxCount: 1 },
  { name: 'img_counselors', maxCount: 1 },
  { name: 'img_features',   maxCount: 1 },
  { name: 'img_book',       maxCount: 1 },
  { name: 'img_faq',        maxCount: 1 },
  { name: 'img_footer',     maxCount: 1 },
])
const heroVisualUpload = multer({ storage: bgStorage, limits: { fileSize: 5 * 1024 * 1024 } }).single('heroVisualImage')
const brandingUpload = multer({ storage: bgStorage, limits: { fileSize: 5 * 1024 * 1024 } }).fields([
  { name: 'headerLogoImage', maxCount: 1 },
  { name: 'footerLogoImage', maxCount: 1 },
  { name: 'faviconImage',    maxCount: 1 },
])
const featuresCollageUpload = multer({ storage: bgStorage, limits: { fileSize: 5 * 1024 * 1024 } }).fields([
  { name: 'collagePhoto1', maxCount: 1 },
  { name: 'collagePhoto2', maxCount: 1 },
  { name: 'collagePhoto3', maxCount: 1 },
  { name: 'collagePhoto4', maxCount: 1 },
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

function readItems(value) {
  return [].concat(value || []).map(item => item.trim()).filter(Boolean)
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

router.post('/branding', brandingUpload, (req, res) => {
  const data = readData()
  const previous = data.branding || {}
  data.branding = {
    headerLogoImage: previous.headerLogoImage || '',
    footerLogoImage: previous.footerLogoImage || '',
    faviconImage: previous.faviconImage || '',
  }
  if (req.body.clear_headerLogoImage) data.branding.headerLogoImage = ''
  if (req.body.clear_footerLogoImage) data.branding.footerLogoImage = ''
  if (req.body.clear_faviconImage) data.branding.faviconImage = ''
  if (req.files && req.files.headerLogoImage && req.files.headerLogoImage[0]) {
    data.branding.headerLogoImage = '/uploads/content/' + req.files.headerLogoImage[0].filename
  }
  if (req.files && req.files.footerLogoImage && req.files.footerLogoImage[0]) {
    data.branding.footerLogoImage = '/uploads/content/' + req.files.footerLogoImage[0].filename
  }
  if (req.files && req.files.faviconImage && req.files.faviconImage[0]) {
    data.branding.faviconImage = '/uploads/content/' + req.files.faviconImage[0].filename
  }
  writeData(data)
  res.redirect('/admin/content?saved=branding')
})

// ── TH endpoints ─────────────────────────────────────────────────────────────
router.post('/hero', heroVisualUpload, (req, res) => {
  const data = readData()
  const previousHero = data.hero || {}
  data.hero = {
    badge:    (req.body.badge    || '').trim(),
    heading1: (req.body.heading1 || '').trim(),
    heading2: (req.body.heading2 || '').trim(),
    subtext:  (req.body.subtext  || '').trim(),
    ctaMain:  (req.body.ctaMain  || '').trim(),
    ctaSub:   (req.body.ctaSub   || '').trim(),
    visualImage: previousHero.visualImage || '',
  }
  if (req.body.clearVisualImage) {
    data.hero.visualImage = ''
  }
  if (req.file) {
    data.hero.visualImage = '/uploads/content/' + req.file.filename
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


router.post('/counselors', (req, res) => {
  const data = readData()
  data.counselors = {
    heading: (req.body.counselorsHeading || '').trim(),
    subtext: (req.body.counselorsSubtext || '').trim(),
  }
  saveTextColors(data, 'counselors', ['heading', 'subtext'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=counselors')
})

router.post('/features', featuresCollageUpload, (req, res) => {
  const data = readData()
  const previousFeatures = data.features || {}
  const files = req.files || {}
  data.features = {
    heading: (req.body.featuresHeading || '').trim(),
    subtext: (req.body.featuresSubtext || '').trim(),
    items: readItems(req.body.featureText),
    collagePhoto1: previousFeatures.collagePhoto1 || '',
    collagePhoto2: previousFeatures.collagePhoto2 || '',
    collagePhoto3: previousFeatures.collagePhoto3 || '',
    collagePhoto4: previousFeatures.collagePhoto4 || '',
    badge1Text: (req.body.badge1Text || '').trim(),
    badge2Text: (req.body.badge2Text || '').trim(),
    badge3Text: (req.body.badge3Text || '').trim(),
    collageMotionEnabled: req.body.collageMotionEnabled !== 'off',
    collageMotionStyle: req.body.collageMotionStyle === 'float' ? 'float' : 'zoom',
    collageMotionDuration: clampNumber(req.body.collageMotionDuration, 38, 8, 90),
    collageMotionScale: clampNumber(req.body.collageMotionScale, 1.12, 1, 1.35),
  }
  ;['collagePhoto1', 'collagePhoto2', 'collagePhoto3', 'collagePhoto4'].forEach(key => {
    if (req.body['clear_' + key]) data.features[key] = ''
    if (files[key] && files[key][0]) data.features[key] = '/uploads/content/' + files[key][0].filename
  })
  saveTextColors(data, 'features', ['heading', 'subtext'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=features')
})

router.post('/book', (req, res) => {
  const data = readData()
  data.book = {
    heading:     (req.body.bookHeading     || '').trim(),
    subtext:     (req.body.bookSubtext     || '').trim(),
    formHeading: (req.body.bookFormHeading || '').trim(),
    concernOptions: readItems(req.body.bookConcernOption),
  }
  saveTextColors(data, 'book', ['heading', 'subtext', 'formHeading'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=book')
})

router.post('/contact-info', (req, res) => {
  const data = readData()
  const currentContact = data.contact || {}
  data.contact = {
    ...currentContact,
    description: (req.body.contactDescription || '').trim(),
    lineLabel: (req.body.contactLineLabel || '').trim(),
    lineUrl: (req.body.contactLineUrl || '').trim(),
    hours: (req.body.contactHours || '').trim(),
    copyright: (req.body.contactCopyright || '').trim(),
  }
  writeData(data)
  res.redirect('/admin/content?saved=contact')
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


router.post('/counselors-en', (req, res) => {
  const data = readData()
  if (!data.en) data.en = {}
  data.en.counselors = {
    heading: (req.body.counselorsHeading || '').trim(),
    subtext: (req.body.counselorsSubtext || '').trim(),
  }
  saveTextColors(data, 'counselors', ['heading', 'subtext'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=counselors-en')
})

router.post('/features-en', (req, res) => {
  const data = readData()
  if (!data.en) data.en = {}
  data.en.features = {
    heading: (req.body.featuresHeading || '').trim(),
    subtext: (req.body.featuresSubtext || '').trim(),
    items: readItems(req.body.featureText),
  }
  saveTextColors(data, 'features', ['heading', 'subtext'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=features-en')
})

router.post('/book-en', (req, res) => {
  const data = readData()
  if (!data.en) data.en = {}
  data.en.book = {
    heading:     (req.body.bookHeading     || '').trim(),
    subtext:     (req.body.bookSubtext     || '').trim(),
    formHeading: (req.body.bookFormHeading || '').trim(),
    concernOptions: readItems(req.body.bookConcernOptionEn || req.body.bookConcernOption),
  }
  saveTextColors(data, 'book', ['heading', 'subtext', 'formHeading'], req.body)
  writeData(data)
  res.redirect('/admin/content?saved=book-en')
})

router.post('/contact-info-en', (req, res) => {
  const data = readData()
  if (!data.en) data.en = {}
  const currentContact = data.en.contact || {}
  data.en.contact = {
    ...currentContact,
    description: (req.body.contactDescription || '').trim(),
    lineLabel: (req.body.contactLineLabel || '').trim(),
    lineUrl: (req.body.contactLineUrl || '').trim(),
    hours: (req.body.contactHours || '').trim(),
    copyright: (req.body.contactCopyright || '').trim(),
  }
  writeData(data)
  res.redirect('/admin/content?saved=contact-en')
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
  footer:     ['description', 'menu', 'menuLink', 'lineLabel', 'hours', 'copyright'],
}

router.post('/backgrounds', bgUpload, (req, res) => {
  const data = readData()
  if (!data.backgrounds) data.backgrounds = {}
  const files = req.files || {}
  const hexRe = /^#[0-9A-Fa-f]{6}$/
  ;['hero', 'counselors', 'features', 'book', 'faq', 'footer'].forEach(sec => {
    const previous = data.backgrounds[sec] || { color: '', image: '' }
    data.backgrounds[sec] = previous

    // Fields are only overwritten when actually present in the request, so a
    // partial submission (e.g. a script or test posting a subset of fields)
    // can't silently reset the other sections' saved values back to defaults.
    if (req.body['color_' + sec] !== undefined) {
      previous.color = req.body['color_' + sec].trim()
    }
    if (req.body['opacity_' + sec] !== undefined) {
      const op = parseFloat(req.body['opacity_' + sec])
      previous.opacity = isNaN(op) ? (typeof previous.opacity === 'number' ? previous.opacity : 1) : Math.min(1, Math.max(0, op))
    }
    if (req.body['imgOpacity_' + sec] !== undefined) {
      const imgOp = parseFloat(req.body['imgOpacity_' + sec])
      previous.imgOpacity = isNaN(imgOp) ? (typeof previous.imgOpacity === 'number' ? previous.imgOpacity : 1) : Math.min(1, Math.max(0, imgOp))
    }
    if (req.body['blend_' + sec] !== undefined) {
      previous.blend = clampNumber(req.body['blend_' + sec], typeof previous.blend === 'number' ? previous.blend : 0, 0, 220)
    }
    if (req.body['blendColor_' + sec] !== undefined) {
      const blendColor = req.body['blendColor_' + sec].trim()
      previous.blendColor = hexRe.test(blendColor) ? blendColor : ''
    }
    if (req.body['motionEnabled_' + sec] !== undefined) {
      previous.motionEnabled = req.body['motionEnabled_' + sec] !== 'off'
    }
    if (req.body['motionDuration_' + sec] !== undefined) {
      previous.motionDuration = clampNumber(req.body['motionDuration_' + sec], typeof previous.motionDuration === 'number' ? previous.motionDuration : 38, 8, 90)
    }
    if (req.body['motionScale_' + sec] !== undefined) {
      previous.motionScale = clampNumber(req.body['motionScale_' + sec], typeof previous.motionScale === 'number' ? previous.motionScale : 1.12, 1, 1.35)
    }
    if (req.body['motionStyle_' + sec] !== undefined) {
      previous.motionStyle = req.body['motionStyle_' + sec] === 'float' ? 'float' : 'zoom'
    }
    const textColors = { ...(previous.textColors || {}) }
    ;(_tcFields[sec] || []).forEach(field => {
      const key = `textColor_${sec}_${field}`
      if (req.body[key] === undefined) return
      const v = req.body[key].trim()
      textColors[field] = hexRe.test(v) ? v : ''
    })
    previous.textColors = textColors
    if (req.body['clear_' + sec]) {
      previous.image = ''
    }
    if (files['img_' + sec] && files['img_' + sec][0]) {
      previous.image = '/uploads/content/' + files['img_' + sec][0].filename
    }
  })
  writeData(data)
  res.redirect('/admin/content?saved=backgrounds')
})

module.exports = router
