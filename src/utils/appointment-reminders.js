const path = require('path')
const { sendReminderEmail } = require('./mailer')
const { readSurveyEmailSettings, getEmailDeliveryConfig, isEmailTypeEnabled, resolveEmailRecipient } = require('./survey-email-settings')
const { readJSON, writeJSON } = require('./json-store')

const dataDir = path.join(__dirname, '../../data')

function read(file) { return readJSON(path.join(dataDir, file)) }
function write(file, d) { writeJSON(path.join(dataDir, file), d) }

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
  // IDs whose reminder was handled this pass (sent, or skipped for good reason
  // e.g. no client email) — collected instead of mutating `appointments`
  // in place, because the loop below awaits real SMTP sends and can take a
  // while; writing a snapshot from before that would silently discard any
  // appointment edit/cancel an admin made via the UI in the meantime.
  const dueIds = []

  for (const appt of appointments) {
    if (appt.reminderSent || appt.status !== 'confirmed') continue

    const apptTime = new Date(`${appt.date}T${appt.time}:00`)
    if (Number.isNaN(apptTime.getTime())) continue

    const msUntil = apptTime.getTime() - now.getTime()
    if (msUntil <= 0 || msUntil > windowMs) continue

    const client = clients.find(c => c.id === appt.clientId)
    const counselor = counselors.find(c => c.id === appt.counselorId)
    if (!client || !counselor || !client.email) {
      dueIds.push(appt.id)
      continue
    }

    try {
      const recipient = resolveEmailRecipient('reminder', client, settings)
      await sendReminderEmail({ appointment: appt, client: recipient, counselor, concern: appt.concern || '', deliveryConfig })
      sent++
      dueIds.push(appt.id)
    } catch (err) {
      console.error('[Email] reminder error:', err.message)
    }
  }

  // Re-read right before writing so this only ever applies reminderSent on
  // top of the latest state, instead of overwriting other fields back to
  // whatever they were when this pass started.
  if (dueIds.length) {
    const latest = read('appointments.json')
    const idSet = new Set(dueIds)
    let changed = false
    for (const appt of latest) {
      if (idSet.has(appt.id) && !appt.reminderSent) {
        appt.reminderSent = true
        changed = true
      }
    }
    if (changed) write('appointments.json', latest)
  }

  return { checked: appointments.length, sent }
}

module.exports = { sendDueAppointmentReminders }
