const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')
const { filterContactsByRequestChannel, withFacultyDisplay } = require('../src/routes/admin/contacts')
const { buildReportRows } = require('../src/routes/admin/reports')

function renderContacts(locals = {}) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'admin', 'contacts.ejs'),
      {
        title: 'Contacts',
        page: 'contacts',
        session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' },
        query: {},
        contacts: [
          {
            id: 'contact-1',
            name: 'Client One',
            studentId: '1680000001',
            facultyIndex: '0',
            faculty: 'Faculty One',
            phone: '0812345678',
            email: 'client@example.com',
            concern: 'Stress',
            sessionType: 'online',
            status: 'new',
            createdAt: '2026-07-01',
          },
        ],
        total: 1,
        statusCounts: { new: 1, contacted: 0, converted: 0, closed: 0 },
        concernOptions: ['Stress'],
        counselorColors: { 'coun-1': '#6366f1' },
        counselors: [
          { id: 'coun-1', name: 'Counselor One', title: 'Psychologist', avatar: 'CO', isApproved: true },
        ],
        schedules: [],
        clients: [],
        appointments: [],
        counselorActiveCounts: {},
        appointmentSessionTypes: { online: true, phone: true, onsite: true },
        ...locals,
      },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('contacts booking panel supports phone type and online meeting link field', async () => {
  const html = await renderContacts()
  const bookPanel = html.match(/id="bookPanel"[\s\S]*?<div id="deleteOverlay"/)?.[0] || ''

  assert.match(bookPanel, /name="type" value="phone"/)
  assert.match(bookPanel, /id="contactMeetingLinkWrap"/)
  assert.match(bookPanel, /name="meetingLink"/)
  assert.match(bookPanel, /Google Meet, Zoom, Microsoft Teams, LINE Meeting/)
  assert.match(html, /function toggleContactMeetingLinkField/)
  assert.match(html, /id="er_typePhone"/)
})

test('contact edit panel offers a request channel dropdown defaulting legacy records to online registration', async () => {
  const html = await renderContacts()
  const editPanel = html.match(/id="editRequestPanel"[\s\S]*?id="bookPanel"/)?.[0] || ''

  assert.match(editPanel, /select name="requestChannel" id="er_requestChannel"/)
  assert.match(editPanel, /option value="online_registration">ลงทะเบียนออนไลน์/)
  assert.match(editPanel, /option value="walk_in">Walk in/)
  assert.match(html, /c\.requestChannel === 'walk_in' \? 'walk_in' : 'online_registration'/)
})

test('contacts table displays request channel after session type and offers a request channel filter', async () => {
  const html = await renderContacts({ query: { requestChannel: 'walk_in' } })
  const header = html.match(/<thead>[\s\S]*?<\/thead>/)?.[0] || ''

  assert.ok(header.indexOf('<th>รูปแบบ</th>') < header.indexOf('<th>ช่องทาง</th>'))
  assert.ok(header.indexOf('<th>ช่องทาง</th>') < header.indexOf('<th>วันที่</th>'))
  assert.match(html, /select name="requestChannel"/)
  assert.match(html, /option value="online_registration"/)
  assert.match(html, /option value="walk_in"/)
  assert.match(html, /value="walk_in" selected/)
  assert.match(html, /ลงทะเบียนออนไลน์/)
  assert.match(html, /colspan="9"/)
})

test('contacts route normalizes legacy channels before applying the request channel filter', () => {
  const contacts = [
    { id: 'legacy' },
    { id: 'online', requestChannel: 'online_registration' },
    { id: 'walk-in', requestChannel: 'walk_in' },
  ]

  assert.deepEqual(
    filterContactsByRequestChannel(contacts, 'online_registration').map(contact => contact.id),
    ['legacy', 'online']
  )
  assert.deepEqual(
    filterContactsByRequestChannel(contacts, 'walk_in').map(contact => contact.id),
    ['walk-in']
  )
})

test('contact request information displays faculty across list and detail surfaces', async () => {
  const html = await renderContacts({
    clients: [{
      id: 'client-1',
      name: 'Client One',
      studentId: '1680000001',
      faculty: 'Faculty One',
      phone: '0812345678',
      email: 'client@example.com',
    }],
  })

  assert.match(html, /Faculty One/)
  assert.match(html, /esc\(c\.faculty \|\|/)
  assert.match(html, /esc\(client\.faculty \|\|/)
})

test('faculty display falls back to the saved faculty index for legacy records', () => {
  const result = withFacultyDisplay(
    { facultyIndex: '1', faculty: '', facultyEn: '' },
    [
      { index: '0', th: 'Faculty Zero', en: 'Faculty Zero EN' },
      { index: '1', th: 'Faculty One', en: 'Faculty One EN' },
    ]
  )

  assert.equal(result.faculty, 'Faculty One')
  assert.equal(result.facultyEn, 'Faculty One EN')
})

test('contact report details include the saved faculty', () => {
  const rows = buildReportRows({
    appointments: [],
    clients: [],
    contacts: [{
      id: 'contact-1',
      name: 'Client One',
      studentId: '1680000001',
      faculty: 'Faculty One',
      phone: '0812345678',
      email: 'client@example.com',
      concern: 'Stress',
      sessionType: 'online',
      status: 'new',
      createdAt: '2026-07-01',
    }],
    surveys: [],
    counselors: [],
  }, {
    type: 'contacts',
    from: '2026-01-01',
    to: '2026-12-31',
  })

  assert.equal(rows.length, 1)
  assert.match(rows[0].detail, /Faculty One/)
})

test('appointment reports prefer the readable appointment number', () => {
  const rows = buildReportRows({
    appointments: [{
      id: 'app-internal',
      appointmentNumber: 'CASE-0001-02',
      clientName: 'Client One',
      counselorName: 'Counselor One',
      date: '2026-07-01',
      time: '10:00',
      type: 'online',
      status: 'confirmed',
    }],
    clients: [],
    contacts: [],
    surveys: [],
    counselors: [],
  }, {
    type: 'appointments',
    from: '2026-01-01',
    to: '2026-12-31',
  })

  assert.equal(rows[0].id, 'CASE-0001-02')
})

test('contacts panels hide disabled session types from backend settings', async () => {
  const html = await renderContacts({ appointmentSessionTypes: { online: true, phone: false, onsite: false } })
  const bookPanel = html.match(/id="bookPanel"[\s\S]*?<div id="deleteOverlay"/)?.[0] || ''

  assert.match(bookPanel, /name="type" value="online"/)
  assert.doesNotMatch(bookPanel, /name="type" value="phone"/)
  assert.doesNotMatch(bookPanel, /name="type" value="onsite"/)
  assert.doesNotMatch(html, /id="er_typePhone"/)
  assert.doesNotMatch(html, /id="er_typeOnsite"/)
})
