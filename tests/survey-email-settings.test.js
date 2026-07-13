const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const ejs = require('ejs')

const settingsPath = path.join(__dirname, '..', 'data', 'survey-email-settings.json')

function requestSurveyEmail(pathname = '/admin/survey-email', method = 'GET', fields = {}) {
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '..', 'views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin', csrfToken: 'test-csrf-token' }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/survey-email', require('../src/routes/admin/survey-email'))

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const body = new URLSearchParams(method === 'POST' ? { ...fields, _csrf: 'test-csrf-token' } : fields).toString()
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathname,
        method,
        headers: method === 'POST' ? {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        } : undefined,
      }, res => {
        let responseBody = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { responseBody += chunk })
        res.on('end', () => server.close(() => resolve({ res, body: responseBody })))
      })
      req.on('error', err => server.close(() => reject(err)))
      req.end(body)
    })
  })
}

function withTempSettingsFile(fn) {
  const before = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : null
  return Promise.resolve().then(fn).finally(() => {
    if (before === null) fs.rmSync(settingsPath, { force: true })
    else fs.writeFileSync(settingsPath, before)
  })
}

test('email test/SMTP status card sits at the top of the จัดการอีเมล page', async () => {
  const getResult = await requestSurveyEmail()
  assert.equal(getResult.res.statusCode, 200)
  assert.match(getResult.body, /ระบบแจ้งเตือนอีเมล/)
  assert.match(getResult.body, /action="\/admin\/survey-email\/test-email"/)
  assert.match(getResult.body, /ตัวแปรใน \.env ที่ต้องตั้งค่า/)
  // Card order: test-email first, then delivery channel, then the outbound list.
  const testCardIndex = getResult.body.indexOf('ระบบแจ้งเตือนอีเมล')
  const deliveryCardIndex = getResult.body.indexOf('ช่องทางการส่งอีเมล')
  const outboundCardIndex = getResult.body.indexOf('อีเมลที่ระบบส่งออก')
  assert.ok(testCardIndex >= 0 && testCardIndex < deliveryCardIndex)
  assert.ok(deliveryCardIndex < outboundCardIndex)
})

test('test-email route redirects with an error when the destination address is missing', async () => {
  const result = await requestSurveyEmail('/admin/survey-email/test-email', 'POST', {})
  assert.equal(result.res.statusCode, 302)
  assert.equal(result.res.headers.location, '/admin/survey-email?emailError=missing')
})

test('test-email route sends a real appointment-confirmation email and redirects with emailSent', async () => {
  const nodemailer = require('nodemailer')
  const originalCreateTransport = nodemailer.createTransport
  const sentMessages = []
  nodemailer.createTransport = () => ({
    sendMail: async message => { sentMessages.push(message); return { messageId: 'test-message-id' } },
  })
  try {
    const result = await requestSurveyEmail('/admin/survey-email/test-email', 'POST', { to: 'test@example.test' })
    assert.equal(result.res.statusCode, 302)
    assert.equal(result.res.headers.location, '/admin/survey-email?emailSent=1')
    assert.equal(sentMessages.length, 2)
    assert.equal(sentMessages[0].to, 'test@example.test')
  } finally {
    nodemailer.createTransport = originalCreateTransport
  }
})

test('page header includes the view-website link like its sibling settings pages', async () => {
  const getResult = await requestSurveyEmail()
  assert.match(getResult.body, /ดูหน้าเว็บไซต์/)
  assert.match(getResult.body, /data-lucide="external-link"/)
})

test('survey email settings page is a system menu item', async () => {
  const sidebar = await ejs.renderFile(
    path.join(__dirname, '..', 'views', 'partials', 'admin-sidebar.ejs'),
    { page: 'survey-email', session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' } }
  )

  assert.match(sidebar, /href="\/admin\/survey-email"/)
  assert.match(sidebar, /จัดการอีเมล/)
  assert.ok(sidebar.indexOf('href="/admin/registration-form"') < sidebar.indexOf('href="/admin/survey-email"'))
  assert.ok(sidebar.indexOf('href="/admin/survey-email"') < sidebar.indexOf('href="/admin/import-export"'))
})

test('survey email settings page saves test and production delivery modes', async () => {
  await withTempSettingsFile(async () => {
    const getResult = await requestSurveyEmail()
    assert.match(getResult.body, /name="deliveryMode"/)
    assert.match(getResult.body, /value="test"/)
    assert.match(getResult.body, /value="gmail"/)
    assert.match(getResult.body, /name="gmailUser"/)
    assert.match(getResult.body, /name="gmailAppPassword"/)

    const postResult = await requestSurveyEmail('/admin/survey-email', 'POST', {
      deliveryMode: 'gmail',
      gmailUser: 'mindcare.sender@gmail.com',
      gmailAppPassword: 'app-password-123',
      fromName: 'MindCare Real',
      fromEmail: 'mindcare.sender@gmail.com',
    })

    assert.equal(postResult.res.statusCode, 302)
    assert.equal(postResult.res.headers.location, '/admin/survey-email?saved=1')
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    assert.equal(saved.deliveryMode, 'gmail')
    assert.equal(saved.gmailUser, 'mindcare.sender@gmail.com')
    assert.equal(saved.gmailAppPassword, 'app-password-123')
    assert.equal(saved.fromName, 'MindCare Real')
    assert.equal(saved.fromEmail, 'mindcare.sender@gmail.com')
  })
})

test('outbound emails card lists every email type with enable/recipient controls', async () => {
  await withTempSettingsFile(async () => {
    const getResult = await requestSurveyEmail()
    assert.equal(getResult.res.statusCode, 200)
    assert.match(getResult.body, /อีเมลที่ระบบส่งออก/)
    for (const type of ['appointmentClient', 'appointmentCounselor', 'counselorReassigned', 'survey', 'reminder']) {
      assert.match(getResult.body, new RegExp(`action="/admin/survey-email/types/${type}"`))
    }
    assert.match(getResult.body, /name="enabled"/)
    assert.match(getResult.body, /name="recipientMode"/)
    assert.match(getResult.body, /name="customEmail"/)
    assert.match(getResult.body, /name="hoursBefore"/)
    assert.match(getResult.body, /แก้ไขข้อความ/)
  })
})

test('outbound emails card embeds tag-free default text for the placeholder hint', async () => {
  await withTempSettingsFile(async () => {
    const getResult = await requestSurveyEmail()
    assert.match(getResult.body, /data-default=/)
    // The raw default has <strong>/<br> for the rendered email — the embedded
    // placeholder data must be the stripped, plain-text version instead.
    assert.doesNotMatch(getResult.body, /data-default='[^']*<strong>/)
    assert.match(getResult.body, /\{\{clientName\}\}/)
  })
})

test('saving one email type enable/recipient does not affect the others', async () => {
  await withTempSettingsFile(async () => {
    const postResult = await requestSurveyEmail('/admin/survey-email/types/survey', 'POST', {
      enabled: 'on',
      recipientMode: 'custom',
      customEmail: 'quality@example.test',
    })
    assert.equal(postResult.res.statusCode, 302)
    assert.equal(postResult.res.headers.location, '/admin/survey-email?saved=1')

    await requestSurveyEmail('/admin/survey-email/types/reminder', 'POST', {
      enabled: 'on',
      recipientMode: 'default',
      hoursBefore: '12',
    })

    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    assert.equal(saved.emailTypes.survey.enabled, true)
    assert.equal(saved.emailTypes.survey.recipientMode, 'custom')
    assert.equal(saved.emailTypes.survey.customEmail, 'quality@example.test')
    assert.equal(saved.emailTypes.reminder.enabled, true)
    assert.equal(saved.emailTypes.reminder.hoursBefore, 12)
    // Untouched types keep their (enabled-by-default) values instead of being reset.
    assert.equal(saved.emailTypes.appointmentClient.enabled, true)
    assert.equal(saved.emailTypes.appointmentCounselor.enabled, true)
    assert.equal(saved.emailTypes.counselorReassigned.enabled, true)
  })
})

test('saving the SMTP card does not clobber previously saved per-type settings', async () => {
  await withTempSettingsFile(async () => {
    await requestSurveyEmail('/admin/survey-email/types/appointmentClient', 'POST', { recipientMode: 'custom', customEmail: 'front-desk@example.test' })
    await requestSurveyEmail('/admin/survey-email', 'POST', { deliveryMode: 'gmail', gmailUser: 'a@example.test', gmailAppPassword: 'x', fromName: 'MindCare', fromEmail: 'a@example.test' })

    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    assert.equal(saved.deliveryMode, 'gmail')
    assert.equal(saved.emailTypes.appointmentClient.recipientMode, 'custom')
    assert.equal(saved.emailTypes.appointmentClient.customEmail, 'front-desk@example.test')
  })
})

test('email type settings default sensibly and unknown types are rejected', async () => {
  const { readSurveyEmailSettings, writeEmailType } = require('../src/utils/survey-email-settings')
  await withTempSettingsFile(async () => {
    const fresh = readSurveyEmailSettings()
    assert.equal(fresh.emailTypes.appointmentClient.enabled, true)
    assert.equal(fresh.emailTypes.appointmentCounselor.enabled, true)
    assert.equal(fresh.emailTypes.counselorReassigned.enabled, true)
    assert.equal(fresh.emailTypes.survey.enabled, true)
    assert.equal(fresh.emailTypes.reminder.enabled, false)
    assert.equal(fresh.emailTypes.reminder.hoursBefore, 24)

    assert.throws(() => writeEmailType('not-a-real-type', { enabled: true }))
  })
})

test('reminder hoursBefore clamps to a sane range', async () => {
  const { writeEmailType } = require('../src/utils/survey-email-settings')
  await withTempSettingsFile(async () => {
    assert.equal(writeEmailType('reminder', { hoursBefore: '0' }).emailTypes.reminder.hoursBefore, 1)
    assert.equal(writeEmailType('reminder', { hoursBefore: '9999' }).emailTypes.reminder.hoursBefore, 168)
    assert.equal(writeEmailType('reminder', { hoursBefore: 'not-a-number' }).emailTypes.reminder.hoursBefore, 24)
  })
})

test('resolveEmailRecipient uses the configured custom email before the person default', () => {
  const { resolveEmailRecipient } = require('../src/utils/survey-email-settings')
  const settings = {
    emailTypes: {
      survey: { enabled: true, recipientMode: 'custom', customEmail: 'quality@example.test' },
      appointmentClient: { enabled: true, recipientMode: 'default', customEmail: 'quality@example.test' },
    },
  }

  assert.deepEqual(
    resolveEmailRecipient('survey', { name: 'Client', email: 'client@example.test' }, settings),
    { name: 'Client', email: 'quality@example.test' }
  )
  assert.deepEqual(
    resolveEmailRecipient('appointmentClient', { name: 'Client', email: 'client@example.test' }, settings),
    { name: 'Client', email: 'client@example.test' }
  )
  assert.deepEqual(
    resolveEmailRecipient('survey', { name: 'Client', email: 'client@example.test' }, {
      emailTypes: { survey: { enabled: true, recipientMode: 'custom', customEmail: 'not-an-email' } },
    }),
    { name: 'Client', email: 'client@example.test' }
  )
})

test('survey email settings build SMTP config for test and Gmail modes', () => {
  const { getEmailDeliveryConfig } = require('../src/utils/survey-email-settings')

  assert.deepEqual(getEmailDeliveryConfig({ deliveryMode: 'test' }), {
    mode: 'test',
    host: 'mailpit',
    port: 1025,
    secure: false,
    auth: false,
    fromName: 'MindCare Docker',
    fromEmail: 'no-reply@mindcare.local',
  })

  assert.deepEqual(getEmailDeliveryConfig({
    deliveryMode: 'gmail',
    gmailUser: 'mindcare.sender@gmail.com',
    gmailAppPassword: 'app-password-123',
    fromName: 'MindCare Real',
    fromEmail: 'sender@example.com',
  }), {
    mode: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: true,
    user: 'mindcare.sender@gmail.com',
    pass: 'app-password-123',
    fromName: 'MindCare Real',
    fromEmail: 'sender@example.com',
  })
})

test('template edit route saves title/greeting text for a plain-closing type', async () => {
  const templatesPath = path.join(__dirname, '..', 'data', 'email-templates.json')
  const before = fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null
  try {
    const postResult = await requestSurveyEmail('/admin/survey-email/templates/survey', 'POST', {
      title: 'ประเมินความพึงพอใจ (ทดสอบ)',
      greeting_th: 'สวัสดี {{clientName}} ทดสอบข้อความ',
      greeting_en: 'Hello {{clientName}} test message',
      closing_th: 'ปิดท้ายทดสอบ',
      closing_en: 'test closing',
    })
    assert.equal(postResult.res.statusCode, 302)
    assert.equal(postResult.res.headers.location, '/admin/survey-email?saved=1')

    const saved = JSON.parse(fs.readFileSync(templatesPath, 'utf8'))
    assert.equal(saved.survey.title.th, 'ประเมินความพึงพอใจ (ทดสอบ)')
    assert.equal(saved.survey.title.en, 'ประเมินความพึงพอใจ (ทดสอบ)')
    assert.equal(saved.survey.greeting.th, 'สวัสดี {{clientName}} ทดสอบข้อความ')
    assert.equal(saved.survey.closing.en, 'test closing')
  } finally {
    if (before === null) fs.rmSync(templatesPath, { force: true })
    else fs.writeFileSync(templatesPath, before)
  }
})

test('template edit route saves separate online/onsite closing text for appointmentClient', async () => {
  const templatesPath = path.join(__dirname, '..', 'data', 'email-templates.json')
  const before = fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null
  try {
    const getResult = await requestSurveyEmail()
    assert.match(getResult.body, /name="closing_online_th"/)
    assert.match(getResult.body, /name="closing_onsite_th"/)

    const postResult = await requestSurveyEmail('/admin/survey-email/templates/appointmentClient', 'POST', {
      title: 'ยืนยันนัดหมาย (ทดสอบ)',
      greeting_th: '', greeting_en: '',
      closing_online_th: 'ออนไลน์: เข้าร่วมทาง Zoom',
      closing_online_en: 'Online: join via Zoom',
      closing_onsite_th: 'มาที่ศูนย์: ชั้น 2',
      closing_onsite_en: 'Onsite: 2nd floor',
    })
    assert.equal(postResult.res.statusCode, 302)

    const saved = JSON.parse(fs.readFileSync(templatesPath, 'utf8'))
    assert.equal(saved.appointmentClient.closing.th.online, 'ออนไลน์: เข้าร่วมทาง Zoom')
    assert.equal(saved.appointmentClient.closing.th.onsite, 'มาที่ศูนย์: ชั้น 2')
    assert.equal(saved.appointmentClient.closing.en.online, 'Online: join via Zoom')
    assert.equal(saved.appointmentClient.closing.en.onsite, 'Onsite: 2nd floor')
  } finally {
    if (before === null) fs.rmSync(templatesPath, { force: true })
    else fs.writeFileSync(templatesPath, before)
  }
})

test('preview route renders the onsite closing text when ?apptType=onsite is given', async () => {
  const result = await requestSurveyEmail('/admin/survey-email/preview/appointmentClient?apptType=onsite', 'POST', {
    title: '', greeting_th: '', greeting_en: '',
    closing_online_th: '', closing_online_en: '',
    closing_onsite_th: 'ทดสอบข้อความ onsite เฉพาะจุด', closing_onsite_en: '',
  })
  assert.equal(result.res.statusCode, 200)
  assert.match(result.body, /ทดสอบข้อความ onsite เฉพาะจุด/)
})

test('preview route renders draft text with placeholders substituted without saving', async () => {
  const templatesPath = path.join(__dirname, '..', 'data', 'email-templates.json')
  const before = fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null
  try {
    const result = await requestSurveyEmail('/admin/survey-email/preview/appointmentClient', 'POST', {
      title: 'ตัวอย่างหัวข้อ',
      greeting_th: 'ทดสอบพรีวิว {{clientName}}',
      greeting_en: '',
      closing_th: '',
      closing_en: '',
    })
    assert.equal(result.res.statusCode, 200)
    assert.match(result.body, /ตัวอย่างหัวข้อ/)
    assert.match(result.body, /ทดสอบพรีวิว ผู้รับบริการตัวอย่าง/)
    assert.equal(fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null, before)
  } finally {
    if (before === null) fs.rmSync(templatesPath, { force: true })
    else fs.writeFileSync(templatesPath, before)
  }
})

test('preview route rejects unknown email types', async () => {
  const result = await requestSurveyEmail('/admin/survey-email/preview/not-a-type', 'POST', {})
  assert.equal(result.res.statusCode, 404)
})

test('template edit route saves access detail text and phone closing for appointment emails', async () => {
  const templatesPath = path.join(__dirname, '..', 'data', 'email-templates.json')
  const before = fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null
  try {
    const getResult = await requestSurveyEmail()
    assert.match(getResult.body, /name="closing_phone_th"/)
    assert.match(getResult.body, /name="access_online_title_th"/)
    assert.match(getResult.body, /name="access_phone_client_notice_text_en"/)

    const postResult = await requestSurveyEmail('/admin/survey-email/templates/appointmentClient', 'POST', {
      title: 'Appointment template test',
      greeting_th: '', greeting_en: '',
      closing_online_th: '', closing_online_en: '',
      closing_phone_th: '', closing_phone_en: 'Phone closing from admin',
      closing_onsite_th: '', closing_onsite_en: '',
      access_online_title_th: '', access_online_title_en: 'Admin video room',
      access_online_link_label_th: '', access_online_link_label_en: 'Admin join label',
      access_phone_title_th: '', access_phone_title_en: 'Admin phone card',
      access_phone_counselor_phone_label_th: '', access_phone_counselor_phone_label_en: 'Admin client phone',
      access_phone_client_notice_label_th: '', access_phone_client_notice_label_en: 'Admin notice',
      access_phone_client_notice_text_th: '', access_phone_client_notice_text_en: 'Admin phone notice',
    })
    assert.equal(postResult.res.statusCode, 302)

    const saved = JSON.parse(fs.readFileSync(templatesPath, 'utf8'))
    assert.equal(saved.appointmentClient.closing.en.phone, 'Phone closing from admin')
    assert.equal(saved.appointmentClient.accessDetails.en.onlineTitle, 'Admin video room')
    assert.equal(saved.appointmentClient.accessDetails.en.onlineLinkLabel, 'Admin join label')
    assert.equal(saved.appointmentClient.accessDetails.en.phoneClientNoticeText, 'Admin phone notice')
  } finally {
    if (before === null) fs.rmSync(templatesPath, { force: true })
    else fs.writeFileSync(templatesPath, before)
  }
})

test('preview route renders phone-specific appointment template text', async () => {
  const result = await requestSurveyEmail('/admin/survey-email/preview/appointmentClient?apptType=phone', 'POST', {
    title: 'Phone preview title', greeting_th: '', greeting_en: '',
    closing_online_th: '', closing_online_en: '',
    closing_phone_th: '', closing_phone_en: 'Phone preview closing',
    closing_onsite_th: '', closing_onsite_en: '',
    access_phone_title_en: 'Phone preview card',
    access_phone_client_notice_label_en: 'Phone preview label',
    access_phone_client_notice_text_en: 'Phone preview notice',
  })
  assert.equal(result.res.statusCode, 200)
  assert.match(result.body, /Phone preview card/)
  assert.match(result.body, /Phone preview notice/)
  assert.match(result.body, /Phone preview closing/)
})

test('survey email template editor renders Thai labels without placeholder question marks', async () => {
  const result = await requestSurveyEmail()
  assert.equal(result.res.statusCode, 200)
  const questionMarks = String.fromCharCode(63, 63, 63)
  assert.equal(result.body.includes(questionMarks), false)
  assert.equal(result.body.includes('(' + questionMarks + ')'), false)
  assert.equal(result.body.includes(String.fromCharCode(32, 63, 32) + '&#x0E23;'), false)
  assert.match(result.body, /&#x0E44;&#x0E17;&#x0E22;/)
  assert.match(result.body, /&mdash;/)
})
