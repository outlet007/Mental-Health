const assert = require('node:assert/strict')
const test = require('node:test')

const {
  filterAppointmentsByStatus,
  resolveAppointmentStatusFilter,
} = require('../src/utils/appointment-status-filter')

const appointments = [
  { id: 'p', status: 'pending' },
  { id: 'c', status: 'confirmed' },
  { id: 'd', status: 'completed' },
  { id: 'x', status: 'cancelled' },
]

test('appointments default to confirmed status when no filter is supplied', () => {
  const status = resolveAppointmentStatusFilter(undefined, false)
  assert.equal(status, 'confirmed')
  assert.deepEqual(filterAppointmentsByStatus(appointments, status, false).map(item => item.id), ['c'])
})

test('counselors cannot open pending and do not receive pending items in the all filter', () => {
  assert.equal(resolveAppointmentStatusFilter('pending', true), 'confirmed')
  assert.deepEqual(
    filterAppointmentsByStatus(appointments, resolveAppointmentStatusFilter('all', true), true).map(item => item.id),
    ['c', 'd', 'x']
  )
})

test('admins can still explicitly filter pending or all appointments', () => {
  assert.deepEqual(filterAppointmentsByStatus(appointments, resolveAppointmentStatusFilter('pending'), false).map(item => item.id), ['p'])
  assert.deepEqual(filterAppointmentsByStatus(appointments, resolveAppointmentStatusFilter('all'), false).map(item => item.id), ['p', 'c', 'd', 'x'])
})
