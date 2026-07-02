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
    req.session = { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/survey-email', require('../src/routes/admin/survey-email'))

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const body = new URLSearchParams(fields).toString()
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

test('survey email settings page is a system menu item', async () => {
  const sidebar = await ejs.renderFile(
    path.join(__dirname, '..', 'views', 'partials', 'admin-sidebar.ejs'),
    { page: 'survey-email', session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' } }
  )

  assert.match(sidebar, /href="\/admin\/survey-email"/)
  assert.match(sidebar, /อีเมลประเมินความพึงพอใจ/)
  assert.ok(sidebar.indexOf('href="/admin/registration-form"') < sidebar.indexOf('href="/admin/survey-email"'))
  assert.ok(sidebar.indexOf('href="/admin/survey-email"') < sidebar.indexOf('href="/admin/import-export"'))
})

test('survey email settings page renders and saves recipient settings', async () => {
  const before = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : null
  try {
    const getResult = await requestSurveyEmail()
    assert.equal(getResult.res.statusCode, 200)
    assert.match(getResult.body, /อีเมลประเมินความพึงพอใจ/)
    assert.match(getResult.body, /name="recipientMode"/)
    assert.match(getResult.body, /name="customEmail"/)

    const postResult = await requestSurveyEmail('/admin/survey-email', 'POST', {
      recipientMode: 'custom',
      customEmail: 'quality@example.test',
    })

    assert.equal(postResult.res.statusCode, 302)
    assert.equal(postResult.res.headers.location, '/admin/survey-email?saved=1')
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    assert.equal(saved.recipientMode, 'custom')
    assert.equal(saved.customEmail, 'quality@example.test')
  } finally {
    if (before === null) fs.rmSync(settingsPath, { force: true })
    else fs.writeFileSync(settingsPath, before)
  }
})

test('survey email recipient uses configured custom email before client email', () => {
  const { resolveSurveyEmailRecipient } = require('../src/utils/survey-email-settings')

  assert.deepEqual(
    resolveSurveyEmailRecipient({ name: 'Client', email: 'client@example.test' }, { recipientMode: 'custom', customEmail: 'quality@example.test' }),
    { name: 'Client', email: 'quality@example.test' }
  )
  assert.deepEqual(
    resolveSurveyEmailRecipient({ name: 'Client', email: 'client@example.test' }, { recipientMode: 'client', customEmail: 'quality@example.test' }),
    { name: 'Client', email: 'client@example.test' }
  )
  assert.deepEqual(
    resolveSurveyEmailRecipient({ name: 'Client', email: 'client@example.test' }, { recipientMode: 'custom', customEmail: 'not-email' }),
    { name: 'Client', email: 'client@example.test' }
  )
})

test('survey email settings page saves test and production delivery modes', async () => {
  const before = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, 'utf8') : null
  try {
    const getResult = await requestSurveyEmail()
    assert.match(getResult.body, /name="deliveryMode"/)
    assert.match(getResult.body, /value="test"/)
    assert.match(getResult.body, /value="gmail"/)
    assert.match(getResult.body, /name="gmailUser"/)
    assert.match(getResult.body, /name="gmailAppPassword"/)

    const postResult = await requestSurveyEmail('/admin/survey-email', 'POST', {
      recipientMode: 'client',
      deliveryMode: 'gmail',
      gmailUser: 'mindcare.sender@gmail.com',
      gmailAppPassword: 'app-password-123',
      fromName: 'MindCare Real',
      fromEmail: 'mindcare.sender@gmail.com',
    })

    assert.equal(postResult.res.statusCode, 302)
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    assert.equal(saved.deliveryMode, 'gmail')
    assert.equal(saved.gmailUser, 'mindcare.sender@gmail.com')
    assert.equal(saved.gmailAppPassword, 'app-password-123')
    assert.equal(saved.fromName, 'MindCare Real')
    assert.equal(saved.fromEmail, 'mindcare.sender@gmail.com')
  } finally {
    if (before === null) fs.rmSync(settingsPath, { force: true })
    else fs.writeFileSync(settingsPath, before)
  }
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
