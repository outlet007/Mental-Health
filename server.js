require('dotenv').config()
const express = require('express')
const session = require('express-session')
const helmet  = require('helmet')
const crypto  = require('crypto')
const path    = require('path')
const { attachSurveyRatingsToCounselors } = require('./src/utils/counselor-survey-ratings')
const { sendDueAppointmentReminders } = require('./src/utils/appointment-reminders')
const { readJSON, ensureDataFiles } = require('./src/utils/json-store')
const { runBackup } = require('./src/utils/backup')
const { logError } = require('./src/utils/logger')

ensureDataFiles(path.join(__dirname, 'data'))

const app = express()

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// CSP/HSTS are left off for now: admin views rely on inline style="..."/<script>
// throughout (project convention, see coding rules) and there's no HTTPS
// termination configured yet, so both would break the app rather than harden
// it. The rest of helmet's defaults (X-Frame-Options, X-Content-Type-Options,
// Referrer-Policy, etc.) are safe additions with no functional impact.
app.use(helmet({ contentSecurityPolicy: false, hsts: false }))

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// No CORS middleware, intentionally: this is a server-rendered app (EJS
// views + session cookies), not an API consumed by a separate frontend/
// mobile app/third party. With no Access-Control-Allow-Origin header ever
// sent, browsers already block cross-origin JS from reading any response by
// default — the correct and safest posture here. If a real cross-origin
// consumer is ever needed, add the `cors` package scoped to specific known
// origins — never `origin: '*'` combined with `credentials: true`, which
// would let any site read authenticated admin responses using a visitor's
// session cookie.

// Session
// No static fallback secret: a hardcoded string here would sit in git history
// same as any other exposed credential. If SESSION_SECRET isn't set, fall back
// to a secret generated fresh for this process only — sessions still work,
// they just don't survive a restart, which is a safer failure mode than a
// predictable secret anyone with repo access could forge cookies with.
if (!process.env.SESSION_SECRET) {
  console.warn('[Security] SESSION_SECRET is not set — using a random secret for this run only. Set SESSION_SECRET in .env so sessions survive restarts.')
}
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' },
}))

// Pass shared data to all EJS views. Falls back to {} on failure (rather than
// the readJSON default of throwing) because this runs before every single
// request — a corrupted content.json should degrade pages to their built-in
// default text, not take the whole site down.
app.use((req, res, next) => {
  res.locals.session = req.session
  try {
    res.locals.content = readJSON(path.join(__dirname, 'data/content.json'))
  } catch (err) {
    res.locals.content = {}
  }
  next()
})

// Health check for monitoring/orchestrators (Docker healthcheck, a load
// balancer, uptime checks). No auth — the whole point is for infra without
// admin credentials to poll it. Actually reads a data file rather than just
// returning 200 unconditionally, so it catches "process is up but the data
// disk is unreadable" too, not just "process is up".
app.get('/health', (req, res) => {
  try {
    readJSON(path.join(__dirname, 'data/content.json'))
    res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) })
  } catch (err) {
    logError('[Health] check failed', err)
    res.status(503).json({ status: 'error' })
  }
})

// Landing page
app.get('/', (req, res) => {
  const counselors = readJSON(path.join(__dirname, 'data/counselors.json'))
  const surveys = readJSON(path.join(__dirname, 'data/surveys.json'), [])
  const approved   = counselors.filter(c => c.isApproved)
  const ratingStats = attachSurveyRatingsToCounselors(approved, surveys)
  const content    = readJSON(path.join(__dirname, 'data/content.json'))
  res.render('index', {
    counselors: ratingStats.counselors,
    counselorRatingAverage: ratingStats.averageRating,
    counselorReviewCount: ratingStats.reviewCount,
    query: req.query,
    content,
  })
})

// Contact form (landing page)
app.use('/contact', require('./src/routes/contact'))

// Public survey (no auth required)
app.use('/survey', require('./src/routes/survey'))

// Auth routes - login/logout (no protection)
app.use('/admin', require('./src/routes/admin/auth'))

// Protect all /admin routes
app.use('/admin', require('./src/middleware/auth'))

// CSRF protection (token generation + verification) is applied inside each
// admin route file via router.use(), not globally here — that way routers
// stay self-protected regardless of how/where they get mounted (production
// server.js, or a test harness that mounts a single route file directly).
// See src/middleware/csrf.js.

// Admin routes
app.use('/admin',               require('./src/routes/admin/index'))
app.use('/admin/counselors',    require('./src/routes/admin/counselors'))
app.use('/admin/appointments',  require('./src/routes/admin/appointments'))
app.use('/admin/clients',       require('./src/routes/admin/clients'))
app.use('/admin/schedules',     require('./src/routes/admin/schedules'))
app.use('/admin/contacts',      require('./src/routes/admin/contacts'))
app.use('/admin/admins',        require('./src/routes/admin/admins'))
app.use('/admin/profile',       require('./src/routes/admin/profile'))
app.use('/admin/content',       require('./src/routes/admin/content'))
app.use('/admin/registration-form', require('./src/routes/admin/registration-form'))
app.use('/admin/survey-email',  require('./src/routes/admin/survey-email'))
app.use('/admin/import-export', require('./src/routes/admin/import-export'))
app.use('/admin/surveys',       require('./src/routes/admin/surveys'))
app.use('/admin/reports',        require('./src/routes/admin/reports'))
app.use('/admin/notifications', require('./src/routes/admin/notifications'))
app.use('/admin/audit-log',     require('./src/routes/admin/audit-log'))

// Global error handler — must be registered after every route. Logs the
// error with request context to a persistent file (console output alone is
// lost on container restart unless something external is capturing it) and
// returns the same generic, detail-free message Express's own default
// handler already used — never the error's own message or stack, since a
// thrown error can carry data that shouldn't reach the client.
app.use((err, req, res, next) => {
  logError(`Unhandled error on ${req.method} ${req.originalUrl}`, err)
  if (res.headersSent) return next(err)
  res.status(err.status || 500)
  if (req.accepts('html')) {
    res.type('html').send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title></head><body><pre>Internal Server Error</pre></body></html>')
  } else {
    res.json({ error: 'Internal Server Error' })
  }
})

// Appointment reminder emails — polls periodically instead of exact scheduling
// since only a JSON file backs appointment state (no job queue).
const REMINDER_CHECK_INTERVAL_MS = 15 * 60 * 1000
const reminderInterval = setInterval(() => {
  sendDueAppointmentReminders().catch(err => logError('[Email] reminder check error', err))
}, REMINDER_CHECK_INTERVAL_MS)

// Local rotating snapshots of data/ + public/uploads/ — a same-disk safety
// net against an accidental delete or bad edit, not a substitute for a real
// offsite backup (see DEPLOYMENT.md). Runs once at startup, then on a timer.
const BACKUP_INTERVAL_MS = parseInt(process.env.BACKUP_INTERVAL_HOURS || '6', 10) * 60 * 60 * 1000
function runBackupSafely() {
  try {
    const result = runBackup()
    if (result.ok) console.log(`[Backup] Snapshot saved to ${result.path}`)
    else console.warn('[Backup] Skipped:', result.reason)
  } catch (err) {
    logError('[Backup] Failed', err)
  }
}
const backupInterval = setInterval(runBackupSafely, BACKUP_INTERVAL_MS)

const PORT = process.env.PORT || 3000
const server = app.listen(PORT, () => {
  console.log(`MindCare running -> http://localhost:${PORT}`)
  sendDueAppointmentReminders().catch(err => logError('[Email] reminder check error', err))
  runBackupSafely()
})

// Graceful shutdown: stop accepting new connections and let in-flight
// requests finish before the process exits, instead of being killed mid
// request. This matters most for requests in the middle of a data-file
// write — even with the atomic write in json-store.js (temp file + rename)
// protecting against a corrupted file, an abrupt kill can still drop a
// request's write entirely. `docker compose down`/restarts send SIGTERM.
function shutdown(signal) {
  console.log(`[Server] Received ${signal}, shutting down gracefully...`)
  clearInterval(reminderInterval)
  clearInterval(backupInterval)
  server.close(err => {
    if (err) { console.error('[Server] Error while closing:', err.message); process.exit(1) }
    console.log('[Server] All connections closed, exiting.')
    process.exit(0)
  })
  // Safety net: if some connection never closes (e.g. a stuck keep-alive),
  // don't hang forever — force exit after a grace period.
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout — a connection did not close in time.')
    process.exit(1)
  }, 10000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
