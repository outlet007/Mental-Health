const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  createCase,
  displayAppointmentNumber,
  ensureCaseAndAppointmentNumbers,
} = require('../src/utils/case-management')
const { migrateCaseNumbering } = require('../src/utils/case-numbering-migration')
const { readJSON, writeJSON } = require('../src/utils/json-store')

test('legacy appointment ids migrate into readable case and visit numbers', () => {
  const cases = []
  const appointments = [
    { id: 'app-0001-02', clientId: 'client-1', date: '2026-06-02', time: '10:00' },
    { id: 'app-0001-01', clientId: 'client-1', date: '2026-06-01', time: '10:00' },
    { id: 'app-0002-01', clientId: 'client-2', date: '2026-06-03', time: '10:00' },
  ]

  const result = ensureCaseAndAppointmentNumbers(cases, appointments)

  assert.equal(result.changed, true)
  assert.equal(cases.length, 2)
  assert.equal(appointments[0].caseId, appointments[1].caseId)
  assert.equal(appointments[0].appointmentNumber, 'CASE-0001-02')
  assert.equal(appointments[1].appointmentNumber, 'CASE-0001-01')
  assert.equal(appointments[2].appointmentNumber, 'CASE-0002-01')
})

test('cancelled appointment numbers are consumed and the next visit advances', () => {
  const cases = []
  const record = createCase(cases, { clientId: 'client-1', openedAt: '2026-06-01' })
  const appointments = [
    { id: 'a1', caseId: record.id, clientId: 'client-1', visitNumber: 1, date: '2026-06-01', status: 'completed' },
    { id: 'a2', caseId: record.id, clientId: 'client-1', visitNumber: 2, date: '2026-06-02', status: 'cancelled' },
    { id: 'a3', caseId: record.id, clientId: 'client-1', date: '2026-06-03', status: 'confirmed' },
  ]

  ensureCaseAndAppointmentNumbers(cases, appointments)

  assert.equal(appointments[2].visitNumber, 3)
  assert.equal(appointments[2].appointmentNumber, 'CASE-0001-03')
})

test('display appointment number falls back to the immutable internal id', () => {
  assert.equal(displayAppointmentNumber({ id: 'app-internal', appointmentNumber: 'CASE-0004-02' }), 'CASE-0004-02')
  assert.equal(displayAppointmentNumber({ id: 'app-internal' }), 'app-internal')
})

test('numbering migration persists additions and is idempotent', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindcare-numbering-'))
  writeJSON(path.join(dataDir, 'cases.json'), [])
  writeJSON(path.join(dataDir, 'appointments.json'), [
    { id: 'app-0007-01', clientId: 'client-7', date: '2026-07-01', time: '09:00' },
  ])
  let backups = 0

  const first = migrateCaseNumbering(dataDir, { beforeWrite: () => { backups += 1 } })
  const second = migrateCaseNumbering(dataDir, { beforeWrite: () => { backups += 1 } })
  const savedAppointment = readJSON(path.join(dataDir, 'appointments.json'))[0]

  assert.equal(first.changed, true)
  assert.equal(second.changed, false)
  assert.equal(backups, 1)
  assert.equal(savedAppointment.appointmentNumber, 'CASE-0007-01')
})
