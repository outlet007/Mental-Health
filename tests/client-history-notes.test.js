const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

const client = {
  id: 'client-1', name: 'Client One', studentId: '10001', email: 'client@example.test',
  phone: '0800000000', age: 20, gender: 'unspecified', status: 'active',
  registeredAt: '2026-01-01', totalSessions: 1,
}
const appointment = {
  id: 'appointment-1', clientId: 'client-1', counselorId: 'counselor-1',
  appointmentNumber: 'CASE-0001-01',
  counselorName: 'Counselor One', date: '2026-08-01', time: '10:00', duration: 60,
  type: 'onsite', status: 'completed', counselorNote: 'Saved consultation note',
  counselorAttachment: { originalName: 'treatment-document.pdf' },
}

test('client-list history renders saved consultation notes and attachment links', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'admin', 'clients.ejs'), {
    title: 'Clients', page: 'clients', content: {}, csrfToken: 'token', query: {},
    session: { userType: 'counselor' }, currentCounselor: null, myTodayApts: 0,
    clients: [client], appointments: [appointment], counselors: [], schedules: [],
    counselorActiveCounts: {}, clientStats: { total: 1, active: 1, inactive: 0, pendingTransfer: 0 },
    counselorColors: {}, pendingTransferClientIds: [], concernOptions: [],
  })

  assert.match(html, /function escapeClientHistoryText\(value\)/)
  assert.match(html, /escapeClientHistoryText\(a\.counselorNote\)/)
  assert.match(html, /a\.counselorAttachment\?\.originalName/)
  assert.match(html, /Saved consultation note/)
  assert.match(html, /treatment-document\.pdf/)
  assert.match(html, /sort=name&amp;order=asc/)
  assert.match(html, /data-client-sort=.appointmentCount./)
  assert.match(html, /escapeClientHistoryText\(a\.appointmentNumber \|\| a\.id \|\|/)
  assert.match(html, /CASE-0001-01/)
  const appointmentNumberLabel = '\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e25\u0e02\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22'
  assert.equal(html.split(appointmentNumberLabel).length - 1, 1)
})

test('standalone client detail renders saved consultation notes and attachment links', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'admin', 'client-detail.ejs'), {
    title: 'Client detail', page: 'clients', content: {}, session: { userType: 'admin' },
    client, appointments: [appointment],
  })

  assert.match(html, /บันทึกการให้คำปรึกษา/)
  assert.match(html, /Saved consultation note/)
  assert.match(html, /\/admin\/appointments\/appointment-1\/consultation-attachment/)
  assert.match(html, /treatment-document\.pdf/)
})
