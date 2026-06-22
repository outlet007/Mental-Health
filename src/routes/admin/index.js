const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '../../../data')

function readData(file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
}

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Dashboard
router.get('/', (req, res) => {
  const counselors   = readData('counselors.json')
  const clients      = readData('clients.json')
  const appointments = readData('appointments.json')
  const contacts     = readData('contacts.json')
  const schedules    = readData('schedules.json')

  const stats = {
    totalCounselors:     counselors.filter(c => c.isApproved).length,
    pendingApproval:     counselors.filter(c => !c.isApproved).length,
    totalClients:        clients.length,
    activeClients:       clients.filter(c => c.status === 'active').length,
    totalAppointments:   appointments.length,
    pendingAppointments: appointments.filter(a => a.status === 'pending').length,
    newContacts:         contacts.filter(c => c.status === 'new').length,
  }

  const recentAppointments = appointments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  // ── Calendar ──────────────────────────────────────────────
  const today    = new Date()
  const todayStr = fmtDate(today)

  const weekParam = req.query.week
  const weekStart = weekParam ? parseLocalDate(weekParam) : getMonday(today)

  const DAY_NAMES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const jsDay = d.getDay()
    return {
      dateStr:       fmtDate(d),
      dayNameShort:  DAY_NAMES[jsDay],
      dayNum:        d.getDate(),
      month:         d.getMonth() + 1,
      isToday:       fmtDate(d) === todayStr,
      schedDayOfWeek: jsDay === 0 ? 7 : jsDay,
    }
  })

  const weekStartStr = weekDays[0].dateStr
  const weekEndStr   = weekDays[6].dateStr
  const weekAppointments = appointments.filter(a =>
    a.date >= weekStartStr && a.date <= weekEndStr && a.status !== 'cancelled'
  )

  const prevWeek = new Date(weekStart); prevWeek.setDate(prevWeek.getDate() - 7)
  const nextWeek = new Date(weekStart); nextWeek.setDate(nextWeek.getDate() + 7)

  // Assign a color per counselor (by index in approved list)
  const PALETTE       = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']
  const LIGHT_PALETTE = ['#dbeafe', '#d1fae5', '#ede9fe', '#fef3c7', '#fee2e2', '#cffafe']
  const counselorColors = {}
  counselors.filter(c => c.isApproved).forEach((c, i) => {
    counselorColors[c.id] = {
      color: PALETTE[i % PALETTE.length],
      light: LIGHT_PALETTE[i % LIGHT_PALETTE.length],
    }
  })

  const counselorMap = {}
  counselors.forEach(c => { counselorMap[c.id] = c })

  // Build grid: HOURS rows × weekDays columns
  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
  const calendarGrid = HOURS.map(h => {
    return weekDays.map(day => {
      const daySchedules = schedules.filter(s =>
        s.dayOfWeek === day.schedDayOfWeek &&
        s.isActive &&
        parseInt(s.startTime.split(':')[0]) <= h &&
        parseInt(s.endTime.split(':')[0]) > h
      )
      const dayApts = weekAppointments.filter(a =>
        a.date === day.dateStr &&
        a.time && parseInt(a.time.split(':')[0]) === h
      )
      return { schedules: daySchedules, appointments: dayApts }
    })
  })

  res.render('admin/dashboard', {
    page: 'dashboard',
    title: 'แดชบอร์ด',
    stats,
    recentAppointments,
    // calendar
    weekDays,
    calendarGrid,
    HOURS,
    counselorColors,
    counselorMap,
    prevWeekStr: fmtDate(prevWeek),
    nextWeekStr: fmtDate(nextWeek),
    weekStartStr,
    weekEndStr,
    todayStr,
  })
})

module.exports = router
