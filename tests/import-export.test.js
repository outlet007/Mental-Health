const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const { readJSON } = require('../src/utils/json-store')

function requestImportExport(pathname) {
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '..', 'views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = {
      adminId: 'admin001',
      userType: 'admin',
      adminName: 'Admin',
      adminEmail: 'admin@example.com',
    }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/import-export', require('../src/routes/admin/import-export'))

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathname,
        method: 'GET',
      }, res => {
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

test('import-export page lists satisfaction surveys as an export-only data type', async () => {
  const { res, body } = await requestImportExport('/admin/import-export?tab=export')

  assert.equal(res.statusCode, 200)
  assert.match(body, /แบบประเมินความพึงพอใจ/)
  assert.match(body, /href="\/admin\/import-export\/export\/surveys\?dateFrom=&amp;dateTo="/)
  assert.doesNotMatch(body, /tab=import&amp;type=surveys/)
})

test('satisfaction survey export downloads a Thai-friendly CSV with complete fields', async () => {
  const { res, body } = await requestImportExport('/admin/import-export/export/surveys')
  const surveys = readJSON(path.join(__dirname, '..', 'data', 'surveys.json'), [])
  const sample = surveys[0]

  assert.equal(res.statusCode, 200)
  assert.match(res.headers['content-type'], /text\/csv/)
  assert.match(res.headers['content-disposition'], /export_surveys_\d{4}-\d{2}-\d{2}\.csv/)
  assert.equal(body.charCodeAt(0), 0xFEFF)
  assert.match(body, /วันที่และเวลาที่ประเมิน/)
  assert.match(body, /ระดับความพึงพอใจ/)
  assert.match(body, /ข้อเสนอแนะ/)
  if (sample) {
    assert.match(body, new RegExp(String(sample.id).replace(/[.*+?^$()|[\]\\]/g, '\\$&')))
    assert.match(body, new RegExp(String(sample.clientName).replace(/[.*+?^$()|[\]\\]/g, '\\$&')))
  }
})

test('CSV exports can be filtered by an inclusive date range', async () => {
  const surveys = readJSON(path.join(__dirname, '..', 'data', 'surveys.json'), [])
  const sorted = surveys.slice().sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)))
  const included = sorted[0]
  const excluded = sorted.find(survey => String(survey.submittedAt).slice(0, 10) !== String(included.submittedAt).slice(0, 10))
  const selectedDate = String(included.submittedAt).slice(0, 10)

  const page = await requestImportExport(`/admin/import-export?tab=export&dateFrom=${selectedDate}&dateTo=${selectedDate}`)
  assert.equal(page.res.statusCode, 200)
  assert.match(page.body, new RegExp(`name="dateFrom" value="${selectedDate}"`))
  assert.match(page.body, new RegExp(`export/surveys\\?dateFrom=${selectedDate}&amp;dateTo=${selectedDate}`))

  const exported = await requestImportExport(`/admin/import-export/export/surveys?dateFrom=${selectedDate}&dateTo=${selectedDate}`)
  assert.equal(exported.res.statusCode, 200)
  assert.match(exported.body, new RegExp(String(included.id).replace(/[.*+?^$()|[\]\\]/g, '\\$&')))
  if (excluded) {
    assert.doesNotMatch(exported.body, new RegExp(String(excluded.id).replace(/[.*+?^$()|[\]\\]/g, '\\$&')))
  }
})
