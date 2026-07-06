const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const dataDir = path.join(__dirname, '..', 'data')

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
}

test('sample client, appointment, and survey data are cross-linked', () => {
  const clients = readJson('clients.json')
  const appointments = readJson('appointments.json')
  const surveys = readJson('surveys.json')
  const counselors = readJson('counselors.json')

  const clientIds = new Set(clients.map(client => client.id))
  const counselorIds = new Set(counselors.map(counselor => counselor.id))
  const appointmentIds = new Set(appointments.map(appointment => appointment.id))
  const completedAppointmentIds = new Set(
    appointments
      .filter(appointment => appointment.status === 'completed')
      .map(appointment => appointment.id)
  )

  assert.equal(clients.length, 52)
  assert.equal(surveys.length, 50)
  assert.equal(new Set(clients.map(client => client.email)).size, 52)
  assert.equal(new Set(clients.map(client => client.studentId)).size, 52)

  for (const client of clients) {
    assert.ok(client.id)
    assert.ok(client.name)
    assert.doesNotMatch(client.name, /\?{2,}/)
    assert.ok(client.email)
    assert.ok(client.phone)
    assert.ok(Number.isInteger(client.totalSessions))
    assert.ok(appointments.some(appointment => appointment.clientId === client.id))
  }

  for (const appointment of appointments) {
    assert.ok(clientIds.has(appointment.clientId), `unknown client ${appointment.clientId}`)
    assert.ok(counselorIds.has(appointment.counselorId), `unknown counselor ${appointment.counselorId}`)
    assert.equal(appointment.clientName, clients.find(client => client.id === appointment.clientId).name)
    assert.equal(appointment.counselorName, counselors.find(counselor => counselor.id === appointment.counselorId).name)
    assert.doesNotMatch(appointment.note || '', /\?{2,}/)
  }

  for (const survey of surveys) {
    assert.ok(appointmentIds.has(survey.appointmentId), `unknown appointment ${survey.appointmentId}`)
    assert.ok(completedAppointmentIds.has(survey.appointmentId), `survey on non-completed appointment ${survey.appointmentId}`)
    assert.ok(clientIds.has(survey.clientId), `unknown survey client ${survey.clientId}`)
    assert.ok(counselorIds.has(survey.counselorId), `unknown survey counselor ${survey.counselorId}`)
    assert.ok(survey.rating >= 1 && survey.rating <= 5)
    assert.doesNotMatch(survey.comment || '', /\?{2,}/)
  }
})
