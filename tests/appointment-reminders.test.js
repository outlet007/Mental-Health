const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const appointmentsPath = path.join(__dirname, '..', 'data', 'appointments.json')
const settingsPath = path.join(__dirname, '..', 'data', 'survey-email-settings.json')

// Reuses real sample client/counselor ids (cl001/c001) already in data/clients.json
// and data/counselors.json — only appointments.json and the reminder settings are
// swapped out for the duration of each test.
const CLIENT_ID = 'cl001'
const COUNSELOR_ID = 'c001'

function withTempJson(filePath, data, fn) {
  const before = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (before === null) fs.rmSync(filePath, { force: true })
      else fs.writeFileSync(filePath, before)
    })
}

// appointment-reminders.js parses `${date}T${time}:00` as local time (no `Z`),
// so build the fixture strings from local getters to match — using UTC getters
// here would silently drift by the host's UTC offset (e.g. Asia/Bangkok, +7).
function isoInHours(now, hours) {
  const d = new Date(now.getTime() + hours * 60 * 60 * 1000)
  const pad = n => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

function loadMailerWithCapturedTransport() {
  const nodemailer = require('nodemailer')
  const originalCreateTransport = nodemailer.createTransport
  const sentMessages = []
  nodemailer.createTransport = () => ({
    sendMail: async message => { sentMessages.push(message); return { messageId: 'test-message-id' } },
  })
  delete require.cache[require.resolve('../src/utils/mailer')]
  delete require.cache[require.resolve('../src/utils/appointment-reminders')]
  const { sendDueAppointmentReminders } = require('../src/utils/appointment-reminders')
  return {
    sendDueAppointmentReminders,
    sentMessages,
    restore() {
      nodemailer.createTransport = originalCreateTransport
      delete require.cache[require.resolve('../src/utils/mailer')]
      delete require.cache[require.resolve('../src/utils/appointment-reminders')]
    },
  }
}

test('sends a due reminder once for a confirmed appointment inside the window', async () => {
  const now = new Date('2026-07-07T00:00:00.000Z')
  const { date, time } = isoInHours(now, 5) // 5h away, within a 24h reminder window

  await withTempJson(settingsPath, { deliveryMode: 'test', emailTypes: { reminder: { enabled: true, recipientMode: 'default', customEmail: '', hoursBefore: 24 } } }, () =>
    withTempJson(appointmentsPath, [
      { id: 'app-reminder-test', clientId: CLIENT_ID, counselorId: COUNSELOR_ID, date, time, duration: 60, type: 'online', status: 'confirmed' },
    ], async () => {
      const harness = loadMailerWithCapturedTransport()
      try {
        const result = await harness.sendDueAppointmentReminders(now)
        assert.equal(result.sent, 1)
        assert.equal(harness.sentMessages.length, 1)

        const saved = JSON.parse(fs.readFileSync(appointmentsPath, 'utf8'))
        assert.equal(saved[0].reminderSent, true)

        // Second pass at the same time must not resend.
        const second = await harness.sendDueAppointmentReminders(now)
        assert.equal(second.sent, 0)
        assert.equal(harness.sentMessages.length, 1)
      } finally {
        harness.restore()
      }
    })
  )
})

test('does not send when reminders are disabled, outside the window, or not confirmed', async () => {
  const now = new Date('2026-07-07T00:00:00.000Z')
  const within = isoInHours(now, 5)
  const tooFar = isoInHours(now, 48)
  const past = isoInHours(now, -2)

  await withTempJson(settingsPath, { deliveryMode: 'test', emailTypes: { reminder: { enabled: false, recipientMode: 'default', customEmail: '', hoursBefore: 24 } } }, () =>
    withTempJson(appointmentsPath, [
      { id: 'app-disabled', clientId: CLIENT_ID, counselorId: COUNSELOR_ID, date: within.date, time: within.time, duration: 60, type: 'online', status: 'confirmed' },
    ], async () => {
      const harness = loadMailerWithCapturedTransport()
      try {
        const result = await harness.sendDueAppointmentReminders(now)
        assert.equal(result.sent, 0)
        assert.equal(harness.sentMessages.length, 0)
      } finally {
        harness.restore()
      }
    })
  )

  await withTempJson(settingsPath, { deliveryMode: 'test', emailTypes: { reminder: { enabled: true, recipientMode: 'default', customEmail: '', hoursBefore: 24 } } }, () =>
    withTempJson(appointmentsPath, [
      { id: 'app-too-far', clientId: CLIENT_ID, counselorId: COUNSELOR_ID, date: tooFar.date, time: tooFar.time, duration: 60, type: 'online', status: 'confirmed' },
      { id: 'app-past', clientId: CLIENT_ID, counselorId: COUNSELOR_ID, date: past.date, time: past.time, duration: 60, type: 'online', status: 'confirmed' },
      { id: 'app-pending', clientId: CLIENT_ID, counselorId: COUNSELOR_ID, date: within.date, time: within.time, duration: 60, type: 'online', status: 'pending' },
      { id: 'app-already-sent', clientId: CLIENT_ID, counselorId: COUNSELOR_ID, date: within.date, time: within.time, duration: 60, type: 'online', status: 'confirmed', reminderSent: true },
    ], async () => {
      const harness = loadMailerWithCapturedTransport()
      try {
        const result = await harness.sendDueAppointmentReminders(now)
        assert.equal(result.sent, 0)
        assert.equal(harness.sentMessages.length, 0)
      } finally {
        harness.restore()
      }
    })
  )
})
