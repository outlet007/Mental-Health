const assert = require('node:assert/strict')
const test = require('node:test')
const { sortClients } = require('../src/routes/admin/clients')

const clients = [
  { id: 'c1', name: 'Beta', studentId: '20', email: 'b@example.test', age: 21, status: 'active' },
  { id: 'c2', name: 'Alpha', studentId: '10', email: 'a@example.test', age: 19, status: 'inactive' },
  { id: 'c3', name: 'Gamma', studentId: '', email: '', age: 25, status: 'active' },
]

const appointments = [
  { id: 'a1', clientId: 'c1', date: '2026-08-01', time: '09:00' },
  { id: 'a2', clientId: 'c1', date: '2026-08-10', time: '10:00' },
  { id: 'a3', clientId: 'c2', date: '2026-07-01', time: '11:00' },
]

test('client sorting supports table fields in both directions before pagination', () => {
  assert.deepEqual(sortClients(clients, appointments, 'name', 'asc').map(client => client.id), ['c2', 'c1', 'c3'])
  assert.deepEqual(sortClients(clients, appointments, 'studentId', 'asc').map(client => client.id), ['c2', 'c1', 'c3'])
  assert.deepEqual(sortClients(clients, appointments, 'age', 'desc').map(client => client.id), ['c3', 'c1', 'c2'])
  assert.deepEqual(sortClients(clients, appointments, 'appointmentCount', 'desc').map(client => client.id), ['c1', 'c2', 'c3'])
  assert.deepEqual(sortClients(clients, appointments, 'lastAppointment', 'asc').map(client => client.id), ['c2', 'c1', 'c3'])
})

test('unknown client sort fields preserve the existing order', () => {
  assert.equal(sortClients(clients, appointments, 'not-allowed', 'asc'), clients)
})
