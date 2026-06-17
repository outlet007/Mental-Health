const express = require('express')
const path    = require('path')
const fs      = require('fs')

const app = express()

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// Landing page
app.get('/', (req, res) => {
  const counselors = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/counselors.json'), 'utf8'))
  const approved = counselors.filter(c => c.isApproved).slice(0, 3)
  res.render('index', { counselors: approved })
})

// Admin routes
app.use('/admin',               require('./src/routes/admin/index'))
app.use('/admin/counselors',    require('./src/routes/admin/counselors'))
app.use('/admin/appointments',  require('./src/routes/admin/appointments'))
app.use('/admin/clients',       require('./src/routes/admin/clients'))
app.use('/admin/schedules',     require('./src/routes/admin/schedules'))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`MindWell running → http://localhost:${PORT}`))
