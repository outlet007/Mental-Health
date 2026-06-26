require('dotenv').config()
const express = require('express')
const session = require('express-session')
const path    = require('path')
const fs      = require('fs')

const app = express()

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'MindCare-session-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000, httpOnly: true },
}))

// Pass session to all EJS views
app.use((req, res, next) => {
  res.locals.session = req.session
  next()
})

// Landing page
app.get('/', (req, res) => {
  const counselors = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/counselors.json'), 'utf8'))
  const approved   = counselors.filter(c => c.isApproved)
  const content    = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/content.json'), 'utf8'))
  res.render('index', { counselors: approved, query: req.query, content })
})

// Contact form (landing page)
app.use('/contact', require('./src/routes/contact'))

// Public survey (no auth required)
app.use('/survey', require('./src/routes/survey'))

// Auth routes — login/logout (no protection)
app.use('/admin', require('./src/routes/admin/auth'))

// Protect all /admin routes
app.use('/admin', require('./src/middleware/auth'))

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
app.use('/admin/import-export', require('./src/routes/admin/import-export'))
app.use('/admin/surveys',       require('./src/routes/admin/surveys'))
app.use('/admin/reports',       require('./src/routes/admin/reports'))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`MindCare running → http://localhost:${PORT}`))
