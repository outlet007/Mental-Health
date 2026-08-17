const path = require('path')
const { readJSON, writeJSON } = require('./json-store')

function getPendingSurveyAppointments(appointments, surveys, counselorId = '') {
  const completedIds = new Set(surveys.map(item => item.appointmentId))
  return appointments
    .filter(item => item.status === 'completed' && !completedIds.has(item.id))
    .filter(item => !counselorId || item.counselorId === counselorId)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.time || '').localeCompare(String(a.time || '')))
}

function recordSurveyEmailSent(appointmentId, dataDir, sentAt = new Date().toISOString()) {
  const file = path.join(dataDir, 'appointments.json')
  const appointments = readJSON(file, [])
  const appointment = appointments.find(item => item.id === appointmentId)
  if (!appointment) return null

  appointment.surveyEmailSentAt = sentAt
  appointment.surveyEmailSendCount = (Number(appointment.surveyEmailSendCount) || 0) + 1
  writeJSON(file, appointments)
  return appointment
}

module.exports = { getPendingSurveyAppointments, recordSurveyEmailSent }
