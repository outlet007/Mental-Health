const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')
const express = require('express')

const clientsRoutePath = path.join(__dirname, '..', 'src', 'routes', 'admin', 'clients.js')
const clientsViewPath = path.join(__dirname, '..', 'views', 'admin', 'clients.ejs')

function renderClients(userType) {
  const client = {
    id: 'client-test', name: 'Test Client', email: 'client@example.test', phone: '0800000000',
    studentId: '10001', status: 'active', registeredAt: '2026-01-01', totalSessions: 0,
  }
  return ejs.renderFile(clientsViewPath, {
    title: 'Clients', page: 'clients', content: {}, csrfToken: 'test-token',
    session: { userType }, currentCounselor: null, myTodayApts: 0,
    clients: [client], appointments: [], counselors: [], schedules: [],
    counselorActiveCounts: {}, clientStats: { total: 1, active: 1, inactive: 0, pendingTransfer: 0 },
    counselorColors: {}, pendingTransferClientIds: [], concernOptions: [], query: {},
  })
}

function postAsCounselor(pathname) {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = {
      adminId: 'counselor-login', userType: 'counselor', counselorId: 'c001',
      csrfToken: 'test-token',
    }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/clients', require('../src/routes/admin/clients'))

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const body = '_csrf=test-token'
      const request = http.request({
        hostname: '127.0.0.1', port: server.address().port, path: pathname, method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) },
      }, response => {
        response.resume()
        response.on('end', () => server.close(() => resolve(response.statusCode)))
      })
      request.on('error', error => server.close(() => reject(error)))
      request.end(body)
    })
  })
}

test('the delete endpoint rejects counselors before reading or deleting client data', () => {
  const source = fs.readFileSync(clientsRoutePath, 'utf8')
  const deleteRoute = source.slice(source.indexOf("router.post('/:id/delete'"), source.indexOf('// ── TRANSFER'))
  const denyIndex = deleteRoute.indexOf('if (isCounselor(req)) return forbidden(res)')
  const readIndex = deleteRoute.indexOf('const clients = readClients()')

  assert.ok(denyIndex >= 0, 'delete route must explicitly deny counselor accounts')
  assert.ok(readIndex > denyIndex, 'counselor denial must run before client data is read')
})

test('the client delete button is visible to admins but hidden from counselors', async () => {
  const adminHtml = await renderClients('admin')
  const counselorHtml = await renderClients('counselor')

  assert.match(adminHtml, /data-action="\/admin\/clients\/client-test\/delete"/)
  assert.doesNotMatch(counselorHtml, /data-action="\/admin\/clients\/client-test\/delete"/)
})

test('a direct counselor request to the client delete endpoint receives 403', async () => {
  const statusCode = await postAsCounselor('/admin/clients/cl001/delete')
  assert.equal(statusCode, 403)
})
