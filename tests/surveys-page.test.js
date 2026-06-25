const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')

function requestSurveys(pathname, session = {}) {
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
      ...session,
    }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/surveys', require('../src/routes/admin/surveys'))

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

test('admin surveys page renders counselor satisfaction summary before the survey table', async () => {
  const { res, body } = await requestSurveys('/admin/surveys?rating=all')

  assert.equal(res.statusCode, 200)
  assert.match(body, /ผลประเมินรายบุคคลนักจิตวิทยา/)
  assert.match(body, /data-counselor-survey-summary="true"/)
  assert.match(body, /data-counselor-survey-row="c001"/)
  assert.match(body, /data-counselor-profile-photo="c001"/)
  assert.match(body, /src="\/uploads\/counselors\/1782125012668\.jpg"/)
  assert.match(body, /ดร\.สุภาพร เมธาวี/)
  assert.match(body, /แบบประเมิน 13 รายการ/)

  const summaryIndex = body.indexOf('ผลประเมินรายบุคคลนักจิตวิทยา')
  const tableIndex = body.indexOf('รายการประเมิน')
  assert.ok(summaryIndex >= 0)
  assert.ok(tableIndex > summaryIndex)
})

test('admin surveys table can be filtered by counselor', async () => {
  const { res, body } = await requestSurveys('/admin/surveys?rating=all&counselorId=c001')

  assert.equal(res.statusCode, 200)
  assert.match(body, /name="counselorId"/)
  assert.match(body, /<div style="display:flex;align-items:center;gap:8px;">\s*<label for="survey-counselor-filter"[^>]*>นักจิตวิทยา<\/label>\s*<select id="survey-counselor-filter"/)
  assert.match(body, /นักจิตวิทยาทั้งหมด/)
  assert.doesNotMatch(body, /ทุกนักจิตวิทยา/)
  assert.match(body, /value="c001" selected/)
  assert.match(body, /class="report-button" type="submit" style="background:#05967e;color:#fff;"/)
  assert.match(body, /data-lucide="filter"/)
  assert.match(body, /href="\/admin\/surveys\/export\.csv\?rating=all&amp;counselorId=c001" style="background:#05967e;color:#fff;"/)
  assert.match(body, /data-lucide="download"/)
  assert.match(body, /Export CSV/)
  assert.match(body, /data-counselor-table-photo="c001"/)
  assert.match(body, /ดร\.สุภาพร เมธาวี/)

  const tbody = body.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || ''
  assert.match(tbody, /ดร\.สุภาพร เมธาวี/)
  assert.doesNotMatch(tbody, /อาจารย์ธีรพงษ์ สันติสุข/)
})

test('admin surveys CSV export uses the same visible table filters', async () => {
  const { res, body } = await requestSurveys('/admin/surveys/export.csv?rating=5&counselorId=c001')

  assert.equal(res.statusCode, 200)
  assert.match(res.headers['content-type'], /text\/csv/)
  assert.match(res.headers['content-disposition'], /surveys-c001-5\.csv/)
  assert.match(body, /ผู้รับบริการ/)
  assert.match(body, /ดร\.สุภาพร เมธาวี/)
  assert.match(body, /Sasithorn Boonsom/)
  assert.doesNotMatch(body, /Ekkachai Tangman/)
  assert.doesNotMatch(body, /อาจารย์ธีรพงษ์ สันติสุข/)
})










