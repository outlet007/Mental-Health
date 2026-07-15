const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')

const CLIENT_ID = 'cl001'

function makeApp(session = {}) {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = { adminId: 'admin001', userType: 'admin', adminName: 'Admin', csrfToken: 'test-csrf-token', ...session }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/clients', require('../src/routes/admin/clients'))
  return app
}

function get(app, pathname) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: pathname, method: 'GET' }, res => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { body += chunk })
        res.on('end', () => server.close(() => resolve({ res, body })))
      })
      req.on('error', err => server.close(() => reject(err)))
      req.end()
    })
  })
}

test('admin can export a client\'s full data as a downloadable JSON file', async () => {
  const { res, body } = await get(makeApp(), `/admin/clients/${CLIENT_ID}/export`)

  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
  assert.match(res.headers['content-disposition'], new RegExp(`attachment; filename="client-${CLIENT_ID}-data-export\\.json"`))

  const payload = JSON.parse(body)
  assert.match(payload.exportedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(payload.client.id, CLIENT_ID)
  assert.ok(Array.isArray(payload.appointments))
  assert.ok(payload.appointments.length > 0, 'should include the client\'s appointment history')
  assert.ok(payload.appointments.every(a => a.clientId === CLIENT_ID), 'must not leak other clients\' appointments')
  assert.ok(Array.isArray(payload.surveys))
  assert.ok(payload.surveys.every(s => s.clientId === CLIENT_ID), 'must not leak other clients\' surveys')
})

test('export redirects (no data leaked) for a client id that does not exist', async () => {
  const { res, body } = await get(makeApp(), '/admin/clients/does-not-exist/export')
  assert.equal(res.statusCode, 302)
  assert.doesNotMatch(body, /"client"/)
})

test('a counselor with no appointment tied to this client is forbidden from exporting their data (IDOR check)', async () => {
  const { res, body } = await get(
    makeApp({ userType: 'counselor', counselorId: 'c-no-relation-to-this-client' }),
    `/admin/clients/${CLIENT_ID}/export`,
  )
  assert.equal(res.statusCode, 403)
  assert.doesNotMatch(body, /"client"/)
})

test('a counselor who does have an appointment with this client can export their data', async () => {
  // c001 is the counselor tied to cl001's real appointments in data/appointments.json
  const { res, body } = await get(
    makeApp({ userType: 'counselor', counselorId: 'c001' }),
    `/admin/clients/${CLIENT_ID}/export`,
  )
  assert.equal(res.statusCode, 200)
  const payload = JSON.parse(body)
  assert.equal(payload.client.id, CLIENT_ID)
})
