const express = require('express')
const router = express.Router()
const { ensureToken, verifyToken } = require('../../middleware/csrf')
router.use(ensureToken)
router.use(verifyToken)
const {
  readSurveyEmailSettings,
  writeSurveyEmailSettings,
  writeEmailType,
} = require('../../utils/survey-email-settings')
const {
  EMAIL_TYPES,
  EMAIL_TYPE_IDS,
  PLACEHOLDERS,
  TYPES_WITH_CLOSING_VARIANTS,
  CLOSING_VARIANTS,
  TYPES_WITH_ACCESS_DETAILS,
  ACCESS_DETAIL_FIELD_KEYS,
  hasClosingVariants,
  readEmailTemplates,
  writeEmailTemplate,
  getPlainDefaultTemplates,
} = require('../../utils/email-templates')
const {
  clientEmailHtml,
  counselorEmailHtml,
  counselorReassignedEmailHtml,
  surveyEmailHtml,
  reminderEmailHtml,
  sendAppointmentEmails,
} = require('../../utils/mailer')

const TYPE_BUILDERS = {
  appointmentClient: clientEmailHtml,
  appointmentCounselor: counselorEmailHtml,
  counselorReassigned: counselorReassignedEmailHtml,
  survey: surveyEmailHtml,
  reminder: reminderEmailHtml,
}

function mockEmailData() {
  return {
    appointment: { id: 'app-00000', date: new Date().toISOString().split('T')[0], time: '10:00', duration: 60, type: 'online', meetingLink: 'https://meet.example.test/mindcare' },
    client: { name: 'ผู้รับบริการตัวอย่าง', email: 'preview@example.test', phone: '08X-XXX-XXXX' },
    counselor: { name: 'ดร.ตัวอย่าง ระบบอีเมล', title: 'นักจิตวิทยาให้คำปรึกษา', email: 'preview@example.test', phone: '08X-XXX-XXXX', specialties: ['ตัวอย่าง'] },
    concern: 'ตัวอย่างเรื่องที่ปรึกษา',
  }
}

router.get('/', (req, res) => {
  res.render('admin/survey-email', {
    page: 'survey-email',
    title: 'จัดการอีเมล',
    settings: readSurveyEmailSettings(),
    templates: readEmailTemplates(),
    defaultTemplates: getPlainDefaultTemplates(),
    emailTypeCatalog: EMAIL_TYPES,
    typesWithClosingVariants: TYPES_WITH_CLOSING_VARIANTS,
    closingVariants: CLOSING_VARIANTS,
    typesWithAccessDetails: TYPES_WITH_ACCESS_DETAILS,
    accessDetailFieldKeys: ACCESS_DETAIL_FIELD_KEYS,
    placeholders: PLACEHOLDERS,
    query: req.query,
  })
})

router.post('/', (req, res) => {
  const body = req.body || {}
  writeSurveyEmailSettings({
    ...readSurveyEmailSettings(),
    deliveryMode: body.deliveryMode,
    gmailUser: body.gmailUser,
    gmailAppPassword: body.gmailAppPassword,
    fromName: body.fromName,
    fromEmail: body.fromEmail,
  })
  res.redirect('/admin/survey-email?saved=1')
})

router.post('/types/:type', (req, res) => {
  const { type } = req.params
  if (!EMAIL_TYPE_IDS.includes(type)) return res.redirect('/admin/survey-email')
  const body = req.body || {}
  writeEmailType(type, {
    enabled: body.enabled === 'on',
    recipientMode: body.recipientMode,
    customEmail: body.customEmail,
    hoursBefore: body.hoursBefore,
  })
  res.redirect('/admin/survey-email?saved=1')
})

// The banner title isn't language-toggled in the rendered email (a single
// heading sits above the TH/EN switch), so one input mirrors both languages.
function draftTemplateFromBody(body, type) {
  const draft = {
    title: { th: body.title, en: body.title },
    greeting: { th: body.greeting_th, en: body.greeting_en },
  }
  draft.closing = hasClosingVariants(type)
    ? {
        th: { online: body.closing_online_th, phone: body.closing_phone_th, onsite: body.closing_onsite_th },
        en: { online: body.closing_online_en, phone: body.closing_phone_en, onsite: body.closing_onsite_en },
      }
    : { th: body.closing_th, en: body.closing_en }
  draft.accessDetails = {
    th: {
      onlineTitle: body.access_online_title_th,
      onlineLinkLabel: body.access_online_link_label_th,
      phoneTitle: body.access_phone_title_th,
      phoneCounselorPhoneLabel: body.access_phone_counselor_phone_label_th,
      phoneClientNoticeLabel: body.access_phone_client_notice_label_th,
      phoneClientNoticeText: body.access_phone_client_notice_text_th,
    },
    en: {
      onlineTitle: body.access_online_title_en,
      onlineLinkLabel: body.access_online_link_label_en,
      phoneTitle: body.access_phone_title_en,
      phoneCounselorPhoneLabel: body.access_phone_counselor_phone_label_en,
      phoneClientNoticeLabel: body.access_phone_client_notice_label_en,
      phoneClientNoticeText: body.access_phone_client_notice_text_en,
    },
  }
  return draft
}

router.post('/templates/:type', (req, res) => {
  const { type } = req.params
  if (!EMAIL_TYPE_IDS.includes(type)) return res.redirect('/admin/survey-email')
  writeEmailTemplate(type, draftTemplateFromBody(req.body || {}, type))
  res.redirect('/admin/survey-email?saved=1')
})

router.post('/preview/:type', (req, res) => {
  const { type } = req.params
  if (!EMAIL_TYPE_IDS.includes(type)) return res.status(404).send('Unknown email type')
  const mock = mockEmailData()
  if (req.query.apptType === 'onsite') mock.appointment.type = 'onsite'
  if (req.query.apptType === 'phone') mock.appointment.type = 'phone'
  const html = TYPE_BUILDERS[type](mock, draftTemplateFromBody(req.body || {}, type))
  res.send(html)
})

// Sends a real appointment-confirmation email straight through SMTP (bypassing
// the enable/recipient toggles above) purely to verify the .env connection works.
router.post('/test-email', async (req, res) => {
  const to = (req.body.to || '').trim()
  if (!to) return res.redirect('/admin/survey-email?emailError=missing')

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
    res.redirect('/admin/survey-email?emailSent=1')
  } catch (err) {
    console.error('[Email test]', err.message)
    res.redirect('/admin/survey-email?emailError=' + encodeURIComponent(err.message))
  }
})

module.exports = router
