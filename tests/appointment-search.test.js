const test = require('node:test')
const assert = require('node:assert/strict')

const { filterAppointmentsBySearch } = require('../src/routes/admin/appointments')

const appointment = {
  id: 'APT-2026-0042',
  appointmentNumber: 'CASE-0042-03',
  caseCode: 'CASE-0042',
  clientName: 'Narin Example',
  counselorName: 'Dr. Mali',
  date: '2026-08-31',
  time: '09:30',
  type: 'onsite',
  duration: 60,
  status: 'confirmed',
  note: 'Follow up',
}

test('appointment search covers every data value displayed in the table', () => {
  const searches = [
    'APT20260042',
    'CASE004203',
    'CASE0042',
    'Narin',
    'Dr Mali',
    '2026/08/31',
    '09:30',
    '\u0e40\u0e02\u0e49\u0e32\u0e23\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e14\u0e49\u0e27\u0e22\u0e15\u0e19\u0e40\u0e2d\u0e07',
    '60 \u0e19\u0e32\u0e17\u0e35',
    '\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e41\u0e25\u0e49\u0e27',
    'Follow up',
  ]

  for (const search of searches) {
    assert.deepEqual(filterAppointmentsBySearch([appointment], search), [appointment], search)
  }
})

test('appointment search excludes rows that do not contain the keyword', () => {
  assert.deepEqual(filterAppointmentsBySearch([appointment], 'not-present'), [])
})

test('empty appointment search keeps the original collection', () => {
  const appointments = [appointment]
  assert.equal(filterAppointmentsBySearch(appointments, ''), appointments)
})
