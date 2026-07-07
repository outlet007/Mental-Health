const fs = require('fs')
const path = require('path')
const { sendReminderEmail } = require('./mailer')
const { readSurveyEmailSettings, getEmailDeliveryConfig, isEmailTypeEnabled, resolveEmailRecipient } = require('./survey-email-settings')

const dataDir = path.join(__dirname, '../../data')

function read(file) { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }
function write(file, d) { fs.writeFileSync(path.join(dataDir, file), JSON.stringify(d, null, 2)) }

// Sends the "appointment coming up" reminder to clients whose confirmed
// appointment falls within emailTypes.reminder.hoursBefore hours from `now`,
// once per appointment (tracked via `reminderSent`). Meant to be polled
// periodically — each call only sends what is due, so a missed tick just
// catches up next time.
async function sendDueAppointmentReminders(now = new Date()) {
  const settings = readSurveyEmailSettings()
  if (!isEmailTypeEnabled('reminder', settings)) return { checked: 0, sent: 0 }

  const windowMs = settings.emailTypes.reminder.hoursBefore * 60 * 60 * 1000
  const appointments = read('appointments.json')
  const clients = read('clients.json')
  const counselors = read('counselors.json')
  const deliveryConfig = getEmailDeliveryConfig(settings)

  let sent = 0
  let changed = false

  for (const appt of appointments) {
    if (appt.reminderSent || appt.status !== 'confirmed') continue

    const apptTime = new Date(`${appt.date}T${appt.time}:00`)
    if (Number.isNaN(apptTime.getTime())) continue

    const msUntil = apptTime.getTime() - now.getTime()
    if (msUntil <= 0 || msUntil > windowMs) continue

    const client = clients.find(c => c.id === appt.clientId)
    const counselor = counselors.find(c => c.id === appt.counselorId)
    if (!client || !counselor || !client.email) {
      appt.reminderSent = true
      changed = true
      continue
    }

    try {
      const recipient = resolveEmailRecipient('reminder', client, settings)
      await sendReminderEmail({ appointment: appt, client: recipient, counselor, concern: appt.concern || '', deliveryConfig })
      sent++
      appt.reminderSent = true
      changed = true
    } catch (err) {
      console.error('[Email] reminder error:', err.message)
    }
  }

  if (changed) write('appointments.json', appointments)
  return { checked: appointments.length, sent }
}

module.exports = { sendDueAppointmentReminders }
