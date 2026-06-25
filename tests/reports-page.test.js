const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const ejs = require('ejs')

const THAI = {
  reports: '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e2a\u0e16\u0e34\u0e15\u0e34',
  system: '\u0e23\u0e30\u0e1a\u0e1a',
  importExport: '\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32-\u0e2a\u0e48\u0e07\u0e2d\u0e2d\u0e01 \u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25',
  fromDate: '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e15\u0e31\u0e49\u0e07\u0e15\u0e49\u0e19',
  toDate: '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e17\u0e35\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e01\u0e32\u0e23',
  dashboardSummary: '\u0e41\u0e14\u0e0a\u0e1a\u0e2d\u0e23\u0e4c\u0e14\u0e2a\u0e23\u0e38\u0e1b\u0e20\u0e32\u0e1e\u0e23\u0e27\u0e21\u0e23\u0e30\u0e1a\u0e1a',
  serviceStats: '\u0e2a\u0e16\u0e34\u0e15\u0e34\u0e01\u0e32\u0e23\u0e43\u0e0a\u0e49\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23',
  appointmentsDaily: '\u0e08\u0e33\u0e19\u0e27\u0e19\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22\u0e23\u0e32\u0e22\u0e27\u0e31\u0e19',
  satisfaction: '\u0e1c\u0e25\u0e1b\u0e23\u0e30\u0e40\u0e21\u0e34\u0e19\u0e04\u0e27\u0e32\u0e21\u0e1e\u0e36\u0e07\u0e1e\u0e2d\u0e43\u0e08',
  counselorSatisfaction: 'ผลประเมินรายบุคคลนักจิตวิทยา',
  searchReports: '\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19',
  type: '\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17',
  date: '\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48',
  id: '\u0e23\u0e2b\u0e31\u0e2a',
  status: '\u0e2a\u0e16\u0e32\u0e19\u0e30',
  appointment: '\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22',
}

function requestReports(pathname) {
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '..', 'views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = { adminId: 'admin001', userType: 'admin', adminName: 'Admin', adminEmail: 'admin@example.com' }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/reports', require('../src/routes/admin/reports'))

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

test('reports page renders overview dashboard, filters, charts, and CSV export link', async () => {
  const { res, body } = await requestReports('/admin/reports?from=2026-06-01&to=2026-06-30&type=all')

  assert.equal(res.statusCode, 200)
  assert.match(body, new RegExp(THAI.reports))
  assert.match(body, new RegExp(THAI.dashboardSummary))
  assert.match(body, new RegExp(THAI.serviceStats))
  assert.match(body, new RegExp(THAI.appointmentsDaily))
  assert.match(body, /data-report-chart="appointments-daily-line"/)
  assert.match(body, /<polyline[^>]+class="daily-appointment-line"/)
  assert.match(body, /<circle[^>]+class="daily-appointment-point"/)
  assert.match(body, new RegExp(THAI.satisfaction))
  assert.match(body, new RegExp(THAI.searchReports))
  assert.match(body, /Export CSV/)
  assert.match(body, /\/admin\/reports\/export\.csv\?from=2026-06-01&amp;to=2026-06-30&amp;type=all/)
  assert.doesNotMatch(body, /name="counselorId"/)
})

test('reports page renders satisfaction results grouped by counselor before report table', async () => {
  const { res, body } = await requestReports('/admin/reports?from=2026-06-01&to=2026-06-30&type=surveys')

  assert.equal(res.statusCode, 200)
  assert.match(body, new RegExp(THAI.counselorSatisfaction))
  assert.match(body, /data-counselor-satisfaction="summary"/)
  assert.match(body, /data-counselor-satisfaction-row="c001"/)
  assert.match(body, /data-counselor-profile-photo="c001"/)
  assert.match(body, /src="\/uploads\/counselors\/1782125012668\.jpg"/)
  assert.match(body, /ดร\.สุภาพร เมธาวี/)
  assert.match(body, /แบบประเมิน 5 รายการ/)
  assert.match(body, /4\.6[\s\S]*\/ 5/)

  const sectionIndex = body.indexOf(THAI.counselorSatisfaction)
  const tableIndex = body.indexOf(THAI.searchReports)
  assert.ok(sectionIndex >= 0)
  assert.ok(tableIndex > sectionIndex)
})
test('reports CSV export returns filtered report rows with Thai-friendly headers', async () => {
  const { res, body } = await requestReports('/admin/reports/export.csv?from=2026-06-01&to=2026-06-30&type=appointments')

  assert.equal(res.statusCode, 200)
  assert.match(res.headers['content-type'], /text\/csv/)
  assert.match(res.headers['content-disposition'], /reports-appointments-2026-06-01-2026-06-30\.csv/)
  assert.match(body, new RegExp(THAI.type))
  assert.match(body, new RegExp(THAI.date))
  assert.match(body, new RegExp(THAI.id))
  assert.match(body, new RegExp(THAI.status))
  assert.match(body, new RegExp(THAI.appointment))
})

test('reports sidebar item is in system group before import-export and labels are readable', async () => {
  const body = await new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'partials', 'admin-sidebar.ejs'),
      { page: 'reports', session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' } },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })

  const contentIndex = body.indexOf('href="/admin/content"')
  const reportsIndex = body.indexOf('href="/admin/reports"')
  const importExportIndex = body.indexOf('href="/admin/import-export"')

  assert.ok(contentIndex >= 0)
  assert.ok(reportsIndex > contentIndex)
  assert.ok(reportsIndex < importExportIndex)
  assert.match(body, new RegExp(THAI.system))
  assert.match(body, new RegExp(THAI.reports))
  assert.match(body, new RegExp(THAI.importExport))
  assert.doesNotMatch(body, /\?{3,}/)
})

test('reports page renders readable Thai labels without placeholder question marks', async () => {
  const { body } = await requestReports('/admin/reports?from=2026-06-01&to=2026-06-30&type=all')

  assert.match(body, new RegExp(THAI.reports))
  assert.match(body, new RegExp(THAI.fromDate))
  assert.match(body, new RegExp(THAI.toDate))
  assert.doesNotMatch(body, /\?{3,}/)
})
test('reports table paginates report rows with selectable 20, 40, or 60 rows per page', async () => {
  const { res, body } = await requestReports('/admin/reports?from=2026-01-01&to=2026-12-31&type=all&page=2&pageSize=40')

  assert.equal(res.statusCode, 200)
  const tbody = body.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || ''
  assert.equal((tbody.match(/<tr>/g) || []).length, 40)
  assert.match(body, /data-report-pagination="table-bottom"/)
  assert.match(body, /Results:\s*41\s*-\s*80\s*of\s*\d+/)
  assert.match(body, /name="pageSize"/)
  assert.match(body, /<option value="20"[\s\S]*?>20<\/option>/)
  assert.match(body, /<option value="40" selected>40<\/option>/)
  assert.match(body, /<option value="60"[\s\S]*?>60<\/option>/)
  assert.match(body, /aria-current="page"[^>]*>2<\/a>/)
  assert.match(body, /href="\/admin\/reports\?from=2026-01-01&amp;to=2026-12-31&amp;type=all&amp;page=5&amp;pageSize=40"/)
  assert.doesNotMatch(body, /Page 2 of \d+/)
  assert.match(body, /href="\/admin\/reports\?from=2026-01-01&amp;to=2026-12-31&amp;type=all&amp;page=1&amp;pageSize=40"/)
  assert.match(body, /href="\/admin\/reports\?from=2026-01-01&amp;to=2026-12-31&amp;type=all&amp;page=3&amp;pageSize=40"/)
})

test('admin table pagination assets are loaded globally for table pages', async () => {
  const { body } = await requestReports('/admin/reports?from=2026-06-01&to=2026-06-30&type=all')

  assert.match(body, /href="\/css\/table-pagination\.css"/)
  assert.match(body, /src="\/js\/table-pagination\.js"/)
  assert.match(body, /data-table-pagination="server"/)
})
test('admin sidebar uses counselor profile photo for logged-in counselor avatar', async () => {
  const body = await new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'partials', 'admin-sidebar.ejs'),
      {
        page: 'dashboard',
        session: {
          adminName: 'ดร.สุภาพร เมธาวี',
          adminEmail: 'supaporn@MindCare.th',
          adminPhoto: '/uploads/counselors/1782125012668.jpg',
          adminAvatar: 'ดเ',
          userType: 'counselor',
        },
      },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })

  assert.match(body, /data-sidebar-profile-photo="true"/)
  assert.match(body, /src="\/uploads\/counselors\/1782125012668\.jpg"/)
  assert.match(body, /alt="ดร\.สุภาพร เมธาวี"/)
})
