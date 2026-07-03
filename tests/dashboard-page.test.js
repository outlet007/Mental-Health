const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

function renderDashboard(locals = {}) {
  const baseLocals = {
    title: 'Dashboard',
    page: 'dashboard',
    session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' },
    stats: {
      totalCounselors: 3,
      pendingApproval: 1,
      totalClients: 8,
      activeClients: 7,
      totalAppointments: 12,
      pendingAppointments: 2,
      newContacts: 4,
      pendingTransferClients: 2,
      confirmRate: 80,
      avgSatisfaction: 90,
      avgRating: '4.5',
      totalSurveys: 6,
      chartDays: [],
    },
    recentAppointments: [],
    weekDays: [
      { dateStr: '2026-06-29', dayNameShort: 'จ', dayNum: 29, month: 6, isToday: false },
      { dateStr: '2026-06-30', dayNameShort: 'อ', dayNum: 30, month: 6, isToday: false },
      { dateStr: '2026-07-01', dayNameShort: 'พ', dayNum: 1, month: 7, isToday: true },
      { dateStr: '2026-07-02', dayNameShort: 'พฤ', dayNum: 2, month: 7, isToday: false },
      { dateStr: '2026-07-03', dayNameShort: 'ศ', dayNum: 3, month: 7, isToday: false },
      { dateStr: '2026-07-04', dayNameShort: 'ส', dayNum: 4, month: 7, isToday: false },
      { dateStr: '2026-07-05', dayNameShort: 'อา', dayNum: 5, month: 7, isToday: false },
    ],
    calendarGrid: Array.from({ length: 10 }, () => Array.from({ length: 7 }, () => ({ schedules: [], appointments: [] }))),
    HOURS: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    counselorColors: {},
    counselorMap: {},
    prevWeekStr: '2026-06-22',
    nextWeekStr: '2026-07-06',
    weekStartStr: '2026-06-29',
    weekEndStr: '2026-07-05',
    todayStr: '2026-07-01',
  }

  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'admin', 'dashboard.ejs'),
      { ...baseLocals, ...locals },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('admin dashboard top stat cards link to their management sections', async () => {
  const html = await renderDashboard()

  assert.match(html, /<a href="\/admin\/clients\?status=pending_transfer"[^>]*class="stat-card"[\s\S]*?ผู้รับบริการที่รอโอนย้าย[\s\S]*?<\/a>/)
  assert.match(html, /<a href="\/admin\/clients"[^>]*class="stat-card"[\s\S]*?ผู้รับบริการทั้งหมด[\s\S]*?<\/a>/)
  assert.match(html, /<a href="\/admin\/appointments"[^>]*class="stat-card"[\s\S]*?นัดหมายทั้งหมด[\s\S]*?<\/a>/)
  assert.match(html, /<a href="\/admin\/contacts"[^>]*class="stat-card"[\s\S]*?คำขอเพื่อทำนัดหมาย[\s\S]*?<\/a>/)
})

test('counselor dashboard top stat cards link to filtered appointment sections', async () => {
  const html = await renderDashboard({
    session: { adminName: 'Counselor', adminEmail: 'counselor@example.com', userType: 'counselor' },
    isCounselorUser: true,
    me: { id: 'coun-1', name: 'Counselor One', title: 'Psychologist', avatar: 'CO' },
    myStats: { total: 9, pending: 2, confirmed: 4, completed: 3, todayApts: 1, confirmRate: 78, completeRate: 33 },
    recentMyApts: [],
    myCalendarGrid: Array.from({ length: 10 }, () => Array.from({ length: 7 }, () => ({ schedules: [], appointments: [] }))),
  })

  assert.match(html, /<a href="\/admin\/appointments"[^>]*class="stat-card"[\s\S]*?นัดหมายทั้งหมด[\s\S]*?<\/a>/)
  assert.match(html, /<a href="\/admin\/appointments\?status=pending"[^>]*class="stat-card"[\s\S]*?รอยืนยัน[\s\S]*?<\/a>/)
  assert.match(html, /<a href="\/admin\/appointments\?status=confirmed"[^>]*class="stat-card"[\s\S]*?ยืนยันแล้ว[\s\S]*?<\/a>/)
  assert.match(html, /<a href="\/admin\/appointments\?status=completed"[^>]*class="stat-card"[\s\S]*?เสร็จสิ้น[\s\S]*?<\/a>/)
})

test('admin dashboard appointment trend chart guards against missing Chart.js CDN', async () => {
  const html = await renderDashboard({
    stats: {
      totalCounselors: 3,
      pendingApproval: 1,
      totalClients: 8,
      activeClients: 7,
      totalAppointments: 12,
      pendingAppointments: 2,
      newContacts: 4,
      pendingTransferClients: 2,
      confirmRate: 80,
      avgSatisfaction: 90,
      avgRating: '4.5',
      totalSurveys: 6,
      chartDays: [{ label: '1/7', pending: 1, confirmed: 2, completed: 3 }],
    },
  })

  assert.match(html, /typeof Chart/)
  assert.match(html, /ChartCtor/)
  assert.doesNotMatch(html, /new Chart\(ctx/)
})
test('admin dashboard appointment trend chart renders as a line chart', async () => {
  const html = await renderDashboard({
    stats: {
      totalCounselors: 3,
      pendingApproval: 1,
      totalClients: 8,
      activeClients: 7,
      totalAppointments: 12,
      pendingAppointments: 2,
      newContacts: 4,
      pendingTransferClients: 2,
      confirmRate: 80,
      avgSatisfaction: 90,
      avgRating: '4.5',
      totalSurveys: 6,
      chartDays: [{ label: '1/7', pending: 1, confirmed: 2, completed: 3 }],
    },
  })

  assert.match(html, /type: 'line'/)
  assert.match(html, /borderColor: '#f59e0b'/)
  assert.match(html, /tension: 0\.35/)
  assert.doesNotMatch(html, /type: 'bar'/)
  assert.doesNotMatch(html, /stacked: true/)
  assert.doesNotMatch(html, /borderRadius: 3/)
})