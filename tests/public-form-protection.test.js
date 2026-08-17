const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const {
  FORM_TOKEN_MIN_AGE_MS,
  FORM_TOKEN_MAX_AGE_MS,
  createFormToken,
  verifyFormToken,
  isHoneypotClear,
  verifyTurnstile,
} = require('../src/utils/public-form-protection')
const { validateContact, isRecentDuplicate } = require('../src/routes/contact')

test('public form timing tokens reject bots that submit too quickly, stale tokens, and tampering', () => {
  const startedAt = 1700000000000
  const token = createFormToken(startedAt)
  assert.equal(verifyFormToken(token, startedAt + FORM_TOKEN_MIN_AGE_MS), true)
  assert.equal(verifyFormToken(token, startedAt + FORM_TOKEN_MIN_AGE_MS - 1), false)
  assert.equal(verifyFormToken(token, startedAt + FORM_TOKEN_MAX_AGE_MS + 1), false)
  assert.equal(verifyFormToken(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), startedAt + 5000), false)
})

test('honeypot accepts an empty field and rejects a populated field', () => {
  assert.equal(isHoneypotClear(''), true)
  assert.equal(isHoneypotClear(undefined), true)
  assert.equal(isHoneypotClear('https://spam.example'), false)
})

test('Turnstile is verified server-side and checks the expected action when configured', async () => {
  const originalFetch = global.fetch
  const originalSiteKey = process.env.TURNSTILE_SITE_KEY
  const originalSecretKey = process.env.TURNSTILE_SECRET_KEY
  const originalHostname = process.env.TURNSTILE_HOSTNAME
  try {
    process.env.TURNSTILE_SITE_KEY = 'site-key'
    process.env.TURNSTILE_SECRET_KEY = 'secret-key'
    process.env.TURNSTILE_HOSTNAME = 'localhost, 127.0.0.1'
    let verifiedHostname = 'localhost'
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ success: true, action: 'contact', hostname: verifiedHostname }),
    })
    assert.equal(await verifyTurnstile({ token: 'valid-token', remoteIp: '127.0.0.1', action: 'contact' }), true)
    verifiedHostname = '127.0.0.1'
    assert.equal(await verifyTurnstile({ token: 'valid-token', remoteIp: '127.0.0.1', action: 'contact' }), true)
    verifiedHostname = 'untrusted.example'
    assert.equal(await verifyTurnstile({ token: 'valid-token', remoteIp: '127.0.0.1', action: 'contact' }), false)
    assert.equal(await verifyTurnstile({ token: 'valid-token', remoteIp: '127.0.0.1', action: 'login' }), false)
    assert.equal(await verifyTurnstile({ token: '', remoteIp: '127.0.0.1', action: 'contact' }), false)
  } finally {
    global.fetch = originalFetch
    if (originalSiteKey === undefined) delete process.env.TURNSTILE_SITE_KEY
    else process.env.TURNSTILE_SITE_KEY = originalSiteKey
    if (originalSecretKey === undefined) delete process.env.TURNSTILE_SECRET_KEY
    else process.env.TURNSTILE_SECRET_KEY = originalSecretKey
    if (originalHostname === undefined) delete process.env.TURNSTILE_HOSTNAME
    else process.env.TURNSTILE_HOSTNAME = originalHostname
  }
})

test('contact validation requires consent and validates identity and contact fields on the server', () => {
  const valid = {
    name: 'Test User',
    studentId: '1680123456',
    facultyIndex: '0',
    phone: '081-234-5678',
    email: 'USER@example.com',
    concern: '',
    type: 'online',
    pdpa_consent: 'on',
  }
  const allowedTypes = new Set(['online'])
  const facultyOptions = [{ index: '0', th: 'คณะตัวอย่าง', en: 'Example Faculty' }]
  assert.deepEqual(validateContact(valid, allowedTypes, facultyOptions, []), {
    audience: 'student',
    name: 'Test User',
    studentId: '1680123456',
    facultyIndex: '0',
    faculty: 'คณะตัวอย่าง',
    facultyEn: 'Example Faculty',
    phone: '0812345678',
    email: 'user@example.com',
    concern: '',
    sessionType: 'online',
  })
  assert.equal(validateContact({ ...valid, pdpa_consent: '' }, allowedTypes, facultyOptions, []), null)
  assert.equal(validateContact({ ...valid, email: 'not-an-email' }, allowedTypes, facultyOptions, []), null)
  assert.equal(validateContact({ ...valid, facultyIndex: '' }, allowedTypes, facultyOptions, []), null)
  assert.equal(validateContact({ ...valid, type: 'carrier-pigeon' }, allowedTypes, facultyOptions, []), null)
})

test('recent duplicate detection uses student id plus normalized email within the cooldown', () => {
  const now = Date.now()
  const contact = { studentId: '1680123456', email: 'user@example.com' }
  assert.equal(isRecentDuplicate([
    { studentId: '1680123456', email: 'USER@example.com', submittedAt: new Date(now - 1000).toISOString() },
  ], contact, now), true)
  assert.equal(isRecentDuplicate([
    { studentId: '1680123456', email: 'user@example.com', submittedAt: new Date(now - 31 * 60 * 1000).toISOString() },
  ], contact, now), false)
})

test('public forms and login render timing tokens, honeypots, and optional Turnstile widgets', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', 'views/index.ejs'), 'utf8')
  const survey = fs.readFileSync(path.join(__dirname, '..', 'views/survey.ejs'), 'utf8')
  const login = fs.readFileSync(path.join(__dirname, '..', 'views/admin/login.ejs'), 'utf8')
  for (const view of [index, survey, login]) {
    assert.match(view, /name="form_token"/)
    assert.match(view, /name="company_website"/)
    assert.match(view, /cf-turnstile/)
  }
})
