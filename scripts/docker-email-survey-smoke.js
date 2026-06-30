const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { sendAppointmentEmails, sendSurveyEmail } = require('../src/utils/mailer')

const dataDir = path.join(__dirname, '..', 'data')
const readJson = file => JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
const writeJson = (file, data) => fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2))

function nextId(items, prefix) {
  const max = items.reduce((value, item) => {
    const match = String(item.id || '').match(new RegExp(`^${prefix}-(\\d+)$`))
    return match ? Math.max(value, parseInt(match[1], 10)) : value
  }, 0)
  return `${prefix}-${String(max + 1).padStart(5, '0')}`
}

async function main() {
  const appointments = readJson('appointments.json')
  const clients = readJson('clients.json')
  const counselors = readJson('counselors.json')

  const client = clients.find(item => item.status !== 'inactive') || clients[0]
  const counselor = counselors.find(item => item.isApproved && item.status === 'active') || counselors[0]
  if (!client || !counselor) throw new Error('Missing sample client or counselor data')

  const now = new Date()
  const appointmentDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const appointment = {
    id: nextId(appointments, 'app'),
    clientId: client.id,
    clientName: client.name,
    counselorId: counselor.id,
    counselorName: counselor.name,
    date: appointmentDate,
    time: '10:00',
    duration: counselor.sessionDuration || 60,
    type: 'online',
    status: 'confirmed',
    note: 'Docker email and survey smoke test',
    createdAt: now.toISOString().slice(0, 10),
  }

  appointments.push(appointment)
  writeJson('appointments.json', appointments)

  const emailClient = {
    name: client.name,
    email: process.env.SMOKE_CLIENT_EMAIL || 'docker-client@example.test',
    phone: client.phone || '',
  }
  const emailCounselor = {
    name: counselor.name,
    title: counselor.title || '',
    email: process.env.SMOKE_COUNSELOR_EMAIL || 'docker-counselor@example.test',
    phone: counselor.phone || '',
    specialties: counselor.specialties || [],
  }

  const appointmentEmail = await sendAppointmentEmails({
    appointment,
    client: emailClient,
    counselor: emailCounselor,
    concern: 'Docker smoke test',
  })

  appointment.status = 'completed'
  appointment.surveyToken = crypto.randomBytes(16).toString('hex')
  writeJson('appointments.json', appointments)

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const surveyUrl = `${baseUrl}/survey/${appointment.surveyToken}`
  const surveyEmail = await sendSurveyEmail({
    appointment,
    client: emailClient,
    counselor: emailCounselor,
    surveyUrl,
  })

  console.log(JSON.stringify({
    ok: true,
    appointmentId: appointment.id,
    appointmentEmail,
    surveyEmail,
    mailpitUrl: 'http://localhost:8025',
    surveyUrl,
    submitRatingExample: `curl -X POST -d "rating=5&comment=Docker smoke test" ${surveyUrl}`,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
