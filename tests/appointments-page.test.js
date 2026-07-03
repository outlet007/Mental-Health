const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

function textFromCodes(codes) {
  return String.fromCodePoint(...codes)
}

const STATUS_HEADER = textFromCodes([0x0E2A, 0x0E16, 0x0E32, 0x0E19, 0x0E30])
const MANAGEMENT_HEADER = textFromCodes([0x0E01, 0x0E32, 0x0E23, 0x0E08, 0x0E31, 0x0E14, 0x0E01, 0x0E32, 0x0E23])
const STATUS_MANAGEMENT_HEADER = textFromCodes([0x0E08, 0x0E31, 0x0E14, 0x0E01, 0x0E32, 0x0E23, 0x0E19, 0x0E31, 0x0E14, 0x0E2B, 0x0E21, 0x0E32, 0x0E22])
const COMPLETE_BUTTON_LABEL = textFromCodes([0x0E43, 0x0E2B, 0x0E49, 0x0E04, 0x0E33, 0x0E1B, 0x0E23, 0x0E36, 0x0E01, 0x0E29, 0x0E32, 0x0E40, 0x0E2A, 0x0E23, 0x0E47, 0x0E08, 0x0E2A, 0x0E34, 0x0E49, 0x0E19])
const PENDING_TABLE_LABEL = textFromCodes([0x0E23, 0x0E2D, 0x0E22, 0x0E37, 0x0E19, 0x0E22, 0x0E31, 0x0E19, 0x0E19, 0x0E31, 0x0E14])
const CANCELLED_TABLE_LABEL = textFromCodes([0x0E22, 0x0E01, 0x0E40, 0x0E25, 0x0E34, 0x0E01, 0x0E19, 0x0E31, 0x0E14])
const CONFIRM_BUTTON_LABEL = textFromCodes([0x0E22, 0x0E37, 0x0E19, 0x0E22, 0x0E31, 0x0E19, 0x0E19, 0x0E31, 0x0E14])
const CANCEL_BUTTON_LABEL = textFromCodes([0x0E22, 0x0E01, 0x0E40, 0x0E25, 0x0E34, 0x0E01, 0x0E19, 0x0E31, 0x0E14])
const VIEW_SITE_LABEL = textFromCodes([0x0E14, 0x0E39, 0x0E2B, 0x0E19, 0x0E49, 0x0E32, 0x0E40, 0x0E27, 0x0E47, 0x0E1A, 0x0E2B, 0x0E25, 0x0E31, 0x0E01])
const VIEW_APPOINTMENT_BUTTON_LABEL = textFromCodes([0x0E14, 0x0E39, 0x0E02, 0x0E49, 0x0E2D, 0x0E21, 0x0E39, 0x0E25, 0x0E19, 0x0E31, 0x0E14])

function renderAppointments(locals = {}) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'admin', 'appointments.ejs'),
      {
        title: 'Appointments',
        page: 'appointments',
        session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' },
        userType: 'admin',
        query: {},
        counselors: [
          { id: 'coun-1', name: 'Counselor One', title: 'Psychologist', avatar: 'CO', isApproved: true, sessionDuration: 60, specialties: ['Stress', 'Anxiety'] },
        ],
        counselorColors: { 'coun-1': '#6366f1' },
        clients: [
          { id: 'client-1', name: 'Client One', phone: '0812345678', email: 'client@example.com' },
        ],
        schedules: [],
        appointments: [
          {
            id: 'app-test-pending',
            clientId: 'client-1',
            clientName: 'Client One',
            counselorId: 'coun-1',
            counselorName: 'Counselor One',
            date: '2026-06-29',
            time: '09:00',
            duration: 60,
            type: 'online',
            status: 'pending',
            note: '',
          },
        ],
        counselorActiveCounts: {},
        myStatusCounts: {},
        clientAppointments: [],
        concernOptions: ['ความวิตกกังวล / ความเครียด', 'ภาวะซึมเศร้า', 'ปัญหาความสัมพันธ์', 'ปัญหาครอบครัว', 'ความเศร้าโศก / การสูญเสีย', 'อื่นๆ'],
        ...locals,
      },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('appointments table separates status action buttons into the final column', async () => {
  const html = await renderAppointments()

  assert.ok(html.indexOf(`<th>${STATUS_HEADER}</th>`) < html.indexOf(`<th>${MANAGEMENT_HEADER}</th>`))
  assert.ok(html.indexOf(`<th>${MANAGEMENT_HEADER}</th>`) < html.indexOf(`<th>${STATUS_MANAGEMENT_HEADER}</th>`))
  const row = html.match(/<tr>[\s\S]*?app-test-pending[\s\S]*?<\/tr>/)?.[0] || ''
  const cells = [...row.matchAll(/<td[\s\S]*?<\/td>/g)].map(match => match[0])
  assert.equal(cells.length, 9)

  const managementCell = cells[7]
  const statusManagementCell = cells[8]

  assert.doesNotMatch(managementCell, /openViewPanel/)
  assert.match(managementCell, /openEditPanel/)
  assert.match(managementCell, /\/admin\/appointments\/app-test-pending\/delete/)
  assert.doesNotMatch(managementCell, /\/admin\/appointments\/app-test-pending\/confirm/)
  assert.doesNotMatch(managementCell, /\/admin\/appointments\/app-test-pending\/cancel/)

  assert.match(statusManagementCell, /openViewPanel/)
  assert.match(statusManagementCell, new RegExp(VIEW_APPOINTMENT_BUTTON_LABEL))
  assert.ok(statusManagementCell.indexOf('openViewPanel') < statusManagementCell.indexOf('/admin/appointments/app-test-pending/confirm'))
  assert.match(statusManagementCell, /\/admin\/appointments\/app-test-pending\/confirm/)
  assert.match(statusManagementCell, /\/admin\/appointments\/app-test-pending\/cancel/)
  assert.match(statusManagementCell, /data-lucide="check"/)
  assert.match(statusManagementCell, /data-lucide="x"/)
  assert.match(statusManagementCell, new RegExp(CONFIRM_BUTTON_LABEL))
  assert.match(statusManagementCell, new RegExp(CANCEL_BUTTON_LABEL))
  assert.match(row, new RegExp(PENDING_TABLE_LABEL))
})

test('appointments header links to the public website', async () => {
  const html = await renderAppointments()

  assert.match(html, /<a href="\/" target="_blank"[\s\S]*data-lucide="external-link"[\s\S]*<\/a>/)
  assert.match(html, new RegExp(VIEW_SITE_LABEL))
})

test('appointments empty state spans the added status management column', async () => {
  const html = await renderAppointments({ appointments: [] })

  assert.match(html, /<tr><td colspan="9"/)
})
test('counselor completion button is in the status management column', async () => {
  const html = await renderAppointments({
    userType: 'counselor',
    session: { adminName: 'Counselor', adminEmail: 'counselor@example.com', userType: 'counselor' },
    appointments: [
      {
        id: 'app-test-confirmed',
        clientId: 'client-1',
        clientName: 'Client One',
        counselorId: 'coun-1',
        counselorName: 'Counselor One',
        date: '2026-06-29',
        time: '10:00',
        duration: 60,
        type: 'onsite',
        status: 'confirmed',
        note: '',
      },
    ],
  })

  const row = html.match(/<tr>[\s\S]*?app-test-confirmed[\s\S]*?<\/tr>/)?.[0] || ''
  const cells = [...row.matchAll(/<td[\s\S]*?<\/td>/g)].map(match => match[0])
  assert.equal(cells.length, 9)

  const managementCell = cells[7]
  const statusManagementCell = cells[8]

  assert.doesNotMatch(managementCell, /openViewPanel/)
  assert.doesNotMatch(managementCell, /openCompletePanel/)
  assert.match(managementCell, /openEditPanel/)
  assert.doesNotMatch(managementCell, /\/admin\/appointments\/app-test-confirmed\/delete/)

  assert.match(statusManagementCell, /openViewPanel/)
  assert.match(statusManagementCell, /openCompletePanel\('app-test-confirmed'\)/)
  assert.match(statusManagementCell, /data-lucide="check-check"/)
  assert.match(statusManagementCell, new RegExp(COMPLETE_BUTTON_LABEL))
  assert.doesNotMatch(statusManagementCell, /\/admin\/appointments\/app-test-confirmed\/confirm/)
  assert.doesNotMatch(statusManagementCell, /\/admin\/appointments\/app-test-confirmed\/cancel/)
})

test('appointments table uses appointment-specific cancelled status label', async () => {
  const html = await renderAppointments({
    appointments: [
      {
        id: 'app-test-cancelled',
        clientId: 'client-1',
        clientName: 'Client One',
        counselorId: 'coun-1',
        counselorName: 'Counselor One',
        date: '2026-06-29',
        time: '11:00',
        duration: 60,
        type: 'online',
        status: 'cancelled',
        note: '',
      },
    ],
  })

  const row = html.match(/<tr>[\s\S]*?app-test-cancelled[\s\S]*?<\/tr>/)?.[0] || ''
  assert.match(row, new RegExp(CANCELLED_TABLE_LABEL))
})
test('edit appointment modal status dropdown uses appointment-specific labels', async () => {
  const html = await renderAppointments()

  const selectMatch = html.match(/<select name="status" id="e_status"[\s\S]*?<\/select>/)
  assert.ok(selectMatch)
  const selectHtml = selectMatch[0]

  assert.match(selectHtml, new RegExp(`<option value="pending">${PENDING_TABLE_LABEL}<\/option>`))
  assert.match(selectHtml, new RegExp(`<option value="confirmed">${CONFIRM_BUTTON_LABEL}<\/option>`))
  assert.match(selectHtml, new RegExp(`<option value="completed">${COMPLETE_BUTTON_LABEL}<\/option>`))
  assert.match(selectHtml, new RegExp(`<option value="cancelled">${CANCELLED_TABLE_LABEL}<\/option>`))
})
