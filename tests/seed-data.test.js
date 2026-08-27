const assert = require('node:assert/strict')
const test = require('node:test')
const { getSeedData } = require('../src/utils/seed-data')

test('getSeedData returns counselors, clients, and appointments keyed by filename', () => {
  const seed = getSeedData()
  assert.deepEqual(Object.keys(seed).sort(), ['appointments.json', 'clients.json', 'counselors.json'])
  assert.equal(seed['counselors.json'].length, 4)
  assert.equal(seed['clients.json'].length, 5)
  assert.equal(seed['appointments.json'].length, 6)
})

test('seed appointments only reference counselor/client ids that exist in the seed data', () => {
  const seed = getSeedData()
  const counselorIds = new Set(seed['counselors.json'].map(c => c.id))
  const clientIds = new Set(seed['clients.json'].map(c => c.id))
  for (const appt of seed['appointments.json']) {
    assert.ok(counselorIds.has(appt.counselorId), `${appt.id} references unknown counselor ${appt.counselorId}`)
    assert.ok(clientIds.has(appt.clientId), `${appt.id} references unknown client ${appt.clientId}`)
  }
})

test('seed data does not include admin credentials', () => {
  const seed = getSeedData()
  assert.ok(!('admins.json' in seed), 'seed-data.js must never seed admins.json')
  for (const counselor of seed['counselors.json']) {
    assert.equal(counselor.password, undefined, `${counselor.id} must not ship a default password`)
    assert.equal(counselor.sessionDuration, undefined, `${counselor.id} must define duration through schedule slots`)
  }
})

test('seed counselor/client dates are relative to today, not hardcoded to a past year', () => {
  const seed = getSeedData()
  const thisYear = new Date().getFullYear()
  for (const counselor of seed['counselors.json']) {
    assert.ok(new Date(counselor.createdAt) <= new Date(), `${counselor.id} createdAt should not be in the future`)
  }
  for (const client of seed['clients.json']) {
    assert.equal(new Date(client.registeredAt).getFullYear() <= thisYear, true)
  }
})
