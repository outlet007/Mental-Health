const assert = require('node:assert/strict')
const test = require('node:test')


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

