const assert = require('node:assert/strict')
const http = require('node:http')
const test = require('node:test')
const express = require('express')
const { ensureToken, verifyToken, verifyParsedToken } = require('../src/middleware/csrf')

// ── Unit tests: exercise the middleware functions directly with mock
// req/res/next so the pass/fail logic is verified in isolation, independent
// of how any specific route happens to wire them up.
test('ensureToken generates a token once and reuses it on later calls', () => {
  const req = { session: {} }
  const res = { locals: {} }
  let nextCalled = 0
  ensureToken(req, res, () => { nextCalled++ })

  assert.equal(nextCalled, 1)
  assert.equal(typeof req.session.csrfToken, 'string')
  assert.ok(req.session.csrfToken.length >= 32)
  assert.equal(res.locals.csrfToken, req.session.csrfToken)

  const firstToken = req.session.csrfToken
  ensureToken(req, res, () => {})
  assert.equal(req.session.csrfToken, firstToken, 'token should not be regenerated on a second call')
})

test('ensureToken is a no-op when there is no session (route-level unit tests without session middleware)', () => {
  const req = {}
  const res = { locals: {} }
  let nextCalled = 0
  ensureToken(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
  assert.equal(res.locals.csrfToken, undefined)
})

test('verifyToken passes through non-POST requests untouched', () => {
  const req = { method: 'GET', session: { csrfToken: 'abc' } }
  let nextCalled = 0
  verifyToken(req, {}, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
})

test('verifyToken passes through multipart POSTs (deferred to the per-route check after multer)', () => {
  const req = { method: 'POST', session: { csrfToken: 'abc' }, is: () => true, body: {} }
  let nextCalled = 0
  verifyToken(req, {}, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
})

test('verifyParsedToken validates a multipart POST after multer has populated req.body', () => {
  const req = {
    method: 'POST',
    session: { csrfToken: 'expected' },
    body: { _csrf: 'wrong' },
  }
  let statusCode = 200
  let sent = ''
  const res = {
    status(code) { statusCode = code; return this },
    send(value) { sent = value; return this },
  }
  let called = false

  verifyParsedToken(req, res, () => { called = true })

  assert.equal(called, false)
  assert.equal(statusCode, 403)
  assert.match(sent, /invalid or missing security token/)
})

test('verifyToken rejects a POST with a missing _csrf field', () => {
  const req = { method: 'POST', session: { csrfToken: 'abc' }, is: () => false, body: {} }
  const res = { status(code) { this.statusCode = code; return this }, send(msg) { this.sent = msg } }
  let nextCalled = 0
  verifyToken(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 403)
})

test('verifyToken rejects a POST with a _csrf field that does not match the session token', () => {
  const req = { method: 'POST', session: { csrfToken: 'abc' }, is: () => false, body: { _csrf: 'wrong' } }
  const res = { status(code) { this.statusCode = code; return this }, send(msg) { this.sent = msg } }
  let nextCalled = 0
  verifyToken(req, res, () => { nextCalled++ })
  assert.equal(nextCalled, 0)
  assert.equal(res.statusCode, 403)
})

test('verifyToken accepts a POST whose _csrf field matches the session token', () => {
  const req = { method: 'POST', session: { csrfToken: 'abc' }, is: () => false, body: { _csrf: 'abc' } }
  let nextCalled = 0
  verifyToken(req, {}, () => { nextCalled++ })
  assert.equal(nextCalled, 1)
})

// ── Integration test: a real HTTP round-trip through Express + express-session
// + this middleware, proving the pieces compose correctly (cookie carries the
// session, the token rendered on GET is the one verifyToken expects on POST).
function buildApp() {
  const session = require('express-session')
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false, cookie: { maxAge: 60000 } }))
  app.use((req, res, next) => { req.session.adminId = 'test-admin'; next() })
  app.use(ensureToken)
  app.get('/token', (req, res) => res.json({ csrfToken: res.locals.csrfToken }))
  app.post('/action', verifyToken, (req, res) => res.json({ ok: true }))
  return app
}

function httpRequest(server, { method, path, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers }, res => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ res, body: data }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

test('end-to-end: a POST without the session-issued token is rejected, and with it is accepted', async () => {
  const app = buildApp()
  const server = app.listen(0)
  try {
    const first = await httpRequest(server, { method: 'GET', path: '/token' })
    const cookie = first.res.headers['set-cookie'][0].split(';')[0]
    const { csrfToken } = JSON.parse(first.body)
    assert.equal(typeof csrfToken, 'string')

    const rejected = await httpRequest(server, {
      method: 'POST', path: '/action', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    })
    assert.equal(rejected.res.statusCode, 403)

    const okBody = `_csrf=${encodeURIComponent(csrfToken)}`
    const accepted = await httpRequest(server, {
      method: 'POST', path: '/action',
      headers: { cookie, 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(okBody) },
      body: okBody,
    })
    assert.equal(accepted.res.statusCode, 200)
    assert.deepEqual(JSON.parse(accepted.body), { ok: true })
  } finally {
    server.close()
  }
})
