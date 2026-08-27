const assert = require('node:assert/strict')
const test = require('node:test')

const {
  ensureActiveCase,
  closeCase,
  normalizeRiskLevel,
  normalizeDisposition,
  visitTypeByAppointment,
  findNextAppointment,
} = require('../src/utils/case-management')

test('closed cases are never reused when the same client returns', () => {
  const cases = []
  const first = ensureActiveCase(cases, { clientId: 'client-1', openedAt: '2026-08-01', concern: 'stress' })
  assert.equal(ensureActiveCase(cases, { clientId: 'client-1', openedAt: '2026-08-02' }).id, first.id)

  closeCase(cases, first.id, { closedAt: '2026-08-03' })
  const returned = ensureActiveCase(cases, { clientId: 'client-1', openedAt: '2026-08-10', concern: 'stress' })

  assert.notEqual(returned.id, first.id)
  assert.equal(cases.length, 2)
  assert.equal(returned.status, 'active')
})

test('visit type is new only for the first appointment within each case', () => {
  const appointments = [
    { id: 'a2', caseId: 'case-1', clientId: 'c1', date: '2026-08-02', time: '10:00' },
    { id: 'a1', caseId: 'case-1', clientId: 'c1', date: '2026-08-01', time: '10:00' },
    { id: 'a3', caseId: 'case-2', clientId: 'c1', date: '2026-08-10', time: '10:00' },
  ]
  const types = visitTypeByAppointment(appointments)
  assert.equal(types.get('a1'), 'new')
  assert.equal(types.get('a2'), 'continuing')
  assert.equal(types.get('a3'), 'new')
})

test('next appointment stays inside the same case and ignores cancellations', () => {
  const appointments = [
    { id: 'a1', caseId: 'case-1', clientId: 'c1', date: '2026-08-01', time: '10:00', status: 'completed' },
    { id: 'cancelled', caseId: 'case-1', clientId: 'c1', date: '2026-08-02', time: '10:00', status: 'cancelled' },
    { id: 'other-case', caseId: 'case-2', clientId: 'c1', date: '2026-08-03', time: '10:00', status: 'confirmed' },
    { id: 'a2', caseId: 'case-1', clientId: 'c1', date: '2026-08-04', time: '09:30', status: 'confirmed' },
  ]
  assert.equal(findNextAppointment(appointments, appointments[0]).id, 'a2')
})

test('clinical enum values fall back safely', () => {
  assert.equal(normalizeRiskLevel('high'), 'high')
  assert.equal(normalizeRiskLevel('unexpected'), 'none')
  assert.equal(normalizeDisposition('closed'), 'closed')
  assert.equal(normalizeDisposition('unexpected'), 'follow_up')
})
