const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const templatesPath = path.join(__dirname, '..', 'data', 'email-templates.json')

function withTempTemplatesFile(fn) {
  const before = fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null
  return Promise.resolve().then(fn).finally(() => {
    if (before === null) fs.rmSync(templatesPath, { force: true })
    else fs.writeFileSync(templatesPath, before)
  })
}


function loadMailerWithCapturedTransport(env) {
  const previousEnv = {}
  for (const key of Object.keys(env)) {
    previousEnv[key] = process.env[key]
    process.env[key] = env[key]
  }

  const nodemailer = require('nodemailer')
  const originalCreateTransport = nodemailer.createTransport
  let capturedOptions = null
  const sentMessages = []

  nodemailer.createTransport = options => {
    capturedOptions = options
    return {
      sendMail: async message => {
        sentMessages.push(message)
        return { messageId: 'test-message-id' }
      },
    }
  }

  delete require.cache[require.resolve('../src/utils/mailer')]
  const mailer = require('../src/utils/mailer')

  return {
    mailer,
    getCapturedOptions: () => capturedOptions,
    sentMessages,
    restore() {
      nodemailer.createTransport = originalCreateTransport
      delete require.cache[require.resolve('../src/utils/mailer')]
      for (const key of Object.keys(env)) {
        if (previousEnv[key] === undefined) delete process.env[key]
        else process.env[key] = previousEnv[key]
      }
    },
  }
}

test('mailer supports local SMTP servers without authentication', async () => {
  const harness = loadMailerWithCapturedTransport({
    SMTP_AUTH: 'false',
    SMTP_HOST: 'mailpit',
    SMTP_PORT: '1025',
    SMTP_SECURE: 'false',
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM_NAME: 'MindCare Docker',
    SMTP_FROM_EMAIL: 'mindcare@example.test',
  })

  try {
    const result = await harness.mailer.sendAppointmentEmails({
      appointment: {
        id: 'app-test',
        appointmentNumber: 'CASE-0001-02',
        date: '2026-07-01',
        time: '10:00',
        duration: 60,
        type: 'online',
        note: '',
      },
      client: { name: 'Test Client', email: 'client@example.test', phone: '' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test', phone: '', specialties: [] },
      concern: '',
    })

    assert.deepEqual(result.sent.map(item => item.to), ['client', 'counselor'])
    assert.equal(harness.getCapturedOptions().host, 'mailpit')
    assert.equal(harness.getCapturedOptions().port, 1025)
    assert.equal(harness.getCapturedOptions().secure, false)
    assert.equal(Object.hasOwn(harness.getCapturedOptions(), 'auth'), false)
    assert.equal(harness.sentMessages.length, 2)
    assert.ok(harness.sentMessages.every(message => message.html.includes('CASE-0001-02')))
  } finally {
    harness.restore()
  }
})
test('appointment emails use Noto Sans Thai and lucide-style icons without emoji', async () => {
  const harness = loadMailerWithCapturedTransport({})

  try {
    await harness.mailer.sendAppointmentEmails({
      appointment: {
        id: 'app-test',
        date: '2026-07-01',
        time: '10:00',
        duration: 60,
        type: 'online',
        note: 'Prepare documents',
      },
      client: { name: 'Test Client', email: 'client@example.test', phone: '0812345678' },
      counselor: {
        name: 'Test Counselor',
        title: 'Clinical Psychologist',
        email: 'counselor@example.test',
        phone: '021234567',
        specialties: ['Stress'],
      },
      concern: 'Stress management',
    })

    assert.equal(harness.sentMessages.length, 2)
    for (const message of harness.sentMessages) {
      assert.match(message.subject, /^[^\p{Extended_Pictographic}]+$/u)
      assert.doesNotMatch(message.html, /\p{Extended_Pictographic}/u)
      assert.match(message.html, /font-family:'Noto Sans Thai','Segoe UI',Arial,sans-serif/)
      assert.match(message.html, /data-email-icon="heart-handshake"/)
      assert.match(message.html, /data-email-icon="video"/)
    }
  } finally {
    harness.restore()
  }
})

test('survey email uses the same lucide satisfaction icons as the survey form', async () => {
  const harness = loadMailerWithCapturedTransport({})

  try {
    await harness.mailer.sendSurveyEmail({
      appointment: {
        id: 'app-test',
        date: '2026-07-01',
        time: '10:00',
        duration: 60,
        type: 'onsite',
      },
      client: { name: 'Test Client', email: 'client@example.test' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test' },
      surveyUrl: 'http://localhost:3010/survey/token-1',
    })

    assert.equal(harness.sentMessages.length, 1)
    const [message] = harness.sentMessages
    assert.match(message.subject, /^[^\p{Extended_Pictographic}]+$/u)
    assert.doesNotMatch(message.html, /\p{Extended_Pictographic}/u)
    assert.match(message.html, /font-family:'Noto Sans Thai','Segoe UI',Arial,sans-serif/)
    for (const icon of ['smile-plus', 'smile', 'meh', 'frown', 'circle-alert']) {
      assert.match(message.html, new RegExp(`data-email-icon="${icon}"`))
    }
  } finally {
    harness.restore()
  }
})


test('reminder email renders appointment details and uses the client email', async () => {
  const harness = loadMailerWithCapturedTransport({})

  try {
    const result = await harness.mailer.sendReminderEmail({
      appointment: { id: 'app-test', date: '2026-07-01', time: '10:00', duration: 60, type: 'online' },
      client: { name: 'Test Client', email: 'client@example.test' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test' },
      concern: 'Stress management',
    })

    assert.equal(result.sent, true)
    assert.equal(harness.sentMessages.length, 1)
    const [message] = harness.sentMessages
    assert.equal(message.to, 'client@example.test')
    assert.match(message.subject, /แจ้งเตือนนัดหมายล่วงหน้า/)
    assert.match(message.html, /Your appointment is coming up soon/)
    assert.match(message.html, /data-email-icon="calendar"/)
  } finally {
    harness.restore()
  }
})

test('appointment confirmation closing text and icon differ between online and onsite', async () => {
  const harness = loadMailerWithCapturedTransport({})

  try {
    await harness.mailer.sendAppointmentEmails({
      appointment: { id: 'app-online', date: '2026-07-01', time: '10:00', duration: 60, type: 'online', note: '' },
      client: { name: 'Test Client', email: 'client@example.test', phone: '' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test', phone: '', specialties: [] },
      concern: '',
    })
    await harness.mailer.sendAppointmentEmails({
      appointment: { id: 'app-onsite', date: '2026-07-01', time: '10:00', duration: 60, type: 'onsite', note: '' },
      client: { name: 'Test Client', email: 'client@example.test', phone: '' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test', phone: '', specialties: [] },
      concern: '',
    })

    const [onlineClientMessage, , onsiteClientMessage] = harness.sentMessages
    assert.match(onlineClientMessage.html, /Please join 5-10 minutes/)
    assert.match(onlineClientMessage.html, /data-email-icon="video"/)
    assert.match(onsiteClientMessage.html, /Please arrive 5-10 minutes/)
    assert.match(onsiteClientMessage.html, /data-email-icon="map-pin"/)
  } finally {
    harness.restore()
  }
})


test('appointment emails include online meeting links and phone call details by audience', async () => {
  const harness = loadMailerWithCapturedTransport({})

  try {
    await harness.mailer.sendAppointmentEmails({
      appointment: { id: 'app-online-link', date: '2026-07-01', time: '10:00', duration: 60, type: 'online', meetingLink: 'https://meet.example.test/abc', note: '' },
      client: { name: 'Test Client', email: 'client@example.test', phone: '0812345678' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test', phone: '', specialties: [] },
      concern: '',
    })
    await harness.mailer.sendAppointmentEmails({
      appointment: { id: 'app-phone', date: '2026-07-01', time: '11:00', duration: 60, type: 'phone', note: '' },
      client: { name: 'Phone Client', email: 'phone-client@example.test', phone: '0899999999' },
      counselor: { name: 'Phone Counselor', email: 'phone-counselor@example.test', phone: '', specialties: [] },
      concern: '',
    })

    const [onlineClient, onlineCounselor, phoneClient, phoneCounselor] = harness.sentMessages
    const thaiClientNotice = "จิตแพทย์จะโทรติดต่อกลับเพื่อให้คำปรึกษา"
    const thaiLinkTitle = "ลิงก์เข้าร่วมวิดีโอคอล"
    // Link now renders as a clickable anchor (href + visible text) in the details
    // card, plus a "join now" button in the closing notice card (client only).
    assert.equal((onlineClient.html.match(/https:\/\/meet\.example\.test\/abc/g) || []).length, 6)
    assert.equal((onlineCounselor.html.match(/https:\/\/meet\.example\.test\/abc/g) || []).length, 4)
    assert.match(onlineClient.html, new RegExp(thaiLinkTitle))
    assert.match(onlineCounselor.html, new RegExp(thaiLinkTitle))
    assert.match(onlineClient.html, /href="https:\/\/meet\.example\.test\/abc" target="_blank" rel="noopener noreferrer"/)
    assert.match(onlineClient.html, /เข้าร่วมวิดีโอคอล/)
    assert.match(onlineClient.html, /Join video call/)
    assert.equal((phoneCounselor.html.match(/0899999999/g) || []).length, 2)
    assert.match(phoneCounselor.html, /Client phone/)
    assert.match(phoneClient.html, /counselor will call you/)
    assert.match(phoneClient.html, new RegExp(thaiClientNotice))
  } finally {
    harness.restore()
  }
})

test('reminder email closing text differs between online and onsite appointments', async () => {
  const harness = loadMailerWithCapturedTransport({})

  try {
    const online = await harness.mailer.sendReminderEmail({
      appointment: { id: 'app-test', date: '2026-07-01', time: '10:00', duration: 60, type: 'online' },
      client: { name: 'Test Client', email: 'client@example.test' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test' },
      concern: '',
    })
    const onsite = await harness.mailer.sendReminderEmail({
      appointment: { id: 'app-test-2', date: '2026-07-01', time: '10:00', duration: 60, type: 'onsite' },
      client: { name: 'Test Client', email: 'client@example.test' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test' },
      concern: '',
    })

    assert.equal(online.sent, true)
    assert.equal(onsite.sent, true)
    assert.match(harness.sentMessages[0].html, /Please join 5-10 minutes/)
    assert.match(harness.sentMessages[1].html, /Please arrive 5-10 minutes/)
  } finally {
    harness.restore()
  }
})

test('reminder email is skipped when the client has no email on file', async () => {
  const harness = loadMailerWithCapturedTransport({})

  try {
    const result = await harness.mailer.sendReminderEmail({
      appointment: { id: 'app-test', date: '2026-07-01', time: '10:00', duration: 60, type: 'online' },
      client: { name: 'Test Client', email: '' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test' },
      concern: '',
    })

    assert.equal(result.skipped, true)
    assert.equal(harness.sentMessages.length, 0)
  } finally {
    harness.restore()
  }
})

test('a saved template override changes the sent email while an untouched type keeps its default text', () => {
  return withTempTemplatesFile(async () => {
    const { writeEmailTemplate } = require('../src/utils/email-templates')
    writeEmailTemplate('appointmentClient', {
      title: { th: 'ยืนยันนัด (ข้อความใหม่)', en: 'ยืนยันนัด (ข้อความใหม่)' },
      greeting: { th: 'สวัสดี {{clientName}} นี่คือข้อความที่ admin แก้ไขเอง', en: '' },
      closing: { th: '', en: '' },
    })

    const harness = loadMailerWithCapturedTransport({})
    try {
      await harness.mailer.sendAppointmentEmails({
        appointment: { id: 'app-test', date: '2026-07-01', time: '10:00', duration: 60, type: 'online', note: '' },
        client: { name: 'สมชาย', email: 'client@example.test', phone: '' },
        counselor: { name: 'Test Counselor', email: 'counselor@example.test', phone: '', specialties: [] },
        concern: '',
      })

      assert.equal(harness.sentMessages.length, 2)
      const [clientMessage, counselorMessage] = harness.sentMessages
      assert.match(clientMessage.subject, /ยืนยันนัด \(ข้อความใหม่\)/)
      assert.match(clientMessage.html, /นี่คือข้อความที่ admin แก้ไขเอง/)
      assert.match(clientMessage.html, /สมชาย/)
      // Counselor email has no override saved — still renders the built-in default.
      assert.match(counselorMessage.html, /You have a new appointment from MindCare/)
    } finally {
      harness.restore()
    }
  })
})

test('emails include in-email Thai and English toggle without web email view links', async () => {
  const harness = loadMailerWithCapturedTransport({})

  try {
    await harness.mailer.sendAppointmentEmails({
      appointment: {
        id: 'app-test',
        date: '2026-07-01',
        time: '10:00',
        duration: 60,
        type: 'online',
        note: '',
      },
      client: { name: 'Test Client', email: 'client@example.test', phone: '0812345678' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test', phone: '021234567', specialties: [] },
      concern: 'Stress management',
    })

    await harness.mailer.sendSurveyEmail({
      appointment: {
        id: 'app-test',
        date: '2026-07-01',
        time: '10:00',
        duration: 60,
        type: 'online',
      },
      client: { name: 'Test Client', email: 'client@example.test' },
      counselor: { name: 'Test Counselor', email: 'counselor@example.test' },
      surveyUrl: 'http://localhost:3010/survey/token-1',
    })

    assert.equal(harness.sentMessages.length, 3)
    for (const message of harness.sentMessages) {
      assert.match(message.html, /data-email-language-switch="true"/)
      assert.match(message.html, /for="email-lang-th"/)
      assert.match(message.html, /for="email-lang-en"/)
      assert.match(message.html, /id="email-lang-th"/)
      assert.match(message.html, /id="email-lang-en"/)
      assert.match(message.html, /class="email-lang-th"/)
      assert.match(message.html, /class="email-lang-en"/)
      assert.match(message.html, /#email-lang-en:checked ~ \.email-lang-en/)
      assert.doesNotMatch(message.html, /\/email-view\//)
      assert.doesNotMatch(message.html, /href="#lang-(th|en)"/)
    }
    assert.match(harness.sentMessages[0].html, /Your appointment has been confirmed/)
    assert.match(harness.sentMessages[1].html, /You have a new appointment/)
    assert.match(harness.sentMessages[2].html, /Please rate your satisfaction/)
  } finally {
    harness.restore()
  }
})

test('saved access detail template overrides change appointment emails', () => {
  return withTempTemplatesFile(async () => {
    const { writeEmailTemplate } = require('../src/utils/email-templates')
    writeEmailTemplate('appointmentClient', {
      title: { th: '', en: '' },
      greeting: { th: '', en: '' },
      closing: { th: { online: '', phone: '', onsite: '' }, en: { online: '', phone: '', onsite: '' } },
      accessDetails: {
        en: {
          onlineTitle: 'Custom video room',
          onlineLinkLabel: 'Custom join label',
          phoneTitle: 'Custom phone card',
          phoneClientNoticeLabel: 'Custom notice label',
          phoneClientNoticeText: 'Custom phone notice for client',
        },
      },
    })
    writeEmailTemplate('appointmentCounselor', {
      title: { th: '', en: '' },
      greeting: { th: '', en: '' },
      closing: { th: '', en: '' },
      accessDetails: {
        en: {
          phoneTitle: 'Counselor phone card',
          phoneCounselorPhoneLabel: 'Custom client phone label',
        },
      },
    })

    const onlineHarness = loadMailerWithCapturedTransport({})
    try {
      await onlineHarness.mailer.sendAppointmentEmails({
        appointment: { id: 'app-online', date: '2026-07-01', time: '10:00', duration: 60, type: 'online', meetingLink: 'https://meet.example.test/custom', note: '' },
        client: { name: 'Client', email: 'client@example.test', phone: '0812345678' },
        counselor: { name: 'Counselor', email: 'counselor@example.test', phone: '021234567', specialties: [] },
        concern: '',
      })
      assert.match(onlineHarness.sentMessages[0].html, /Custom video room/)
      assert.match(onlineHarness.sentMessages[0].html, /Custom join label/)
      assert.match(onlineHarness.sentMessages[0].html, /https:\/\/meet\.example\.test\/custom/)
    } finally {
      onlineHarness.restore()
    }

    const phoneHarness = loadMailerWithCapturedTransport({})
    try {
      await phoneHarness.mailer.sendAppointmentEmails({
        appointment: { id: 'app-phone', date: '2026-07-01', time: '10:00', duration: 60, type: 'phone', note: '' },
        client: { name: 'Client', email: 'client@example.test', phone: '0812345678' },
        counselor: { name: 'Counselor', email: 'counselor@example.test', phone: '021234567', specialties: [] },
        concern: '',
      })
      assert.match(phoneHarness.sentMessages[0].html, /Custom phone notice for client/)
      assert.match(phoneHarness.sentMessages[1].html, /Counselor phone card/)
      assert.match(phoneHarness.sentMessages[1].html, /Custom client phone label/)
      assert.match(phoneHarness.sentMessages[1].html, /0812345678/)
    } finally {
      phoneHarness.restore()
    }
  })
})
