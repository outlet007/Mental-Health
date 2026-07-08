const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

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
          { id: 'coun-1', name: 'Counselor One', title: 'Psychologist', avatar: 'CO', isApproved: true, sessionDuration: 60 },
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

test('contacts panels hide disabled session types from backend settings', async () => {
  const html = await renderContacts({ appointmentSessionTypes: { online: true, phone: false, onsite: false } })
  const bookPanel = html.match(/id="bookPanel"[\s\S]*?<div id="deleteOverlay"/)?.[0] || ''

  assert.match(bookPanel, /name="type" value="online"/)
  assert.doesNotMatch(bookPanel, /name="type" value="phone"/)
  assert.doesNotMatch(bookPanel, /name="type" value="onsite"/)
  assert.doesNotMatch(html, /id="er_typePhone"/)
  assert.doesNotMatch(html, /id="er_typeOnsite"/)
})
