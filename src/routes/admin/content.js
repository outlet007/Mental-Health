const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const { sendAppointmentEmails } = require('../../utils/mailer')

const dataFile = path.join(__dirname, '../../../data/content.json')

function readData()   { return JSON.parse(fs.readFileSync(dataFile, 'utf8')) }
function writeData(d) { fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)) }

router.get('/', (req, res) => {
  const content = readData()
  res.render('admin/content', {
    page: 'content', title: 'จัดการเนื้อหาเว็บไซต์',
    content, query: req.query,
  })
})

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
  writeData(data)
  res.redirect('/admin/content?saved=faqs')
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
      concern:   'ทดสอบการส่งอีเมลจากระบบ MindWell',
    })
    res.redirect('/admin/content?emailSent=1')
  } catch (err) {
    console.error('[Email test]', err.message)
    res.redirect('/admin/content?emailError=' + encodeURIComponent(err.message))
  }
})

module.exports = router
