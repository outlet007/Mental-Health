const express = require('express')
const router = express.Router()
const { ensureToken, verifyToken } = require('../../middleware/csrf')
router.use(ensureToken)
router.use(verifyToken)
const path = require('path')
const { readJSON } = require('../../utils/json-store')

const dataDir = path.join(__dirname, '../../../data')

function readData(file) {
  return readJSON(path.join(dataDir, file))
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

router.get('/', (req, res) => {
  const counselors   = readData('counselors.json')
  const appointments = readData('appointments.json')
  const schedules    = readData('schedules.json')

  // Shared week helpers
  const today      = new Date()
  const todayStr   = fmtDate(today)
  const weekParam  = req.query.week
  const weekStart  = weekParam ? parseLocalDate(weekParam) : getMonday(today)
  const DAY_NAMES  = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
  const weekDays   = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i)
    const jsDay = d.getDay()
    return {
      dateStr:        fmtDate(d),
      dayNameShort:   DAY_NAMES[jsDay],
      dayNum:         d.getDate(),
      month:          d.getMonth() + 1,
      isToday:        fmtDate(d) === todayStr,
      schedDayOfWeek: jsDay === 0 ? 7 : jsDay,
    }
  })
  const weekStartStr = weekDays[0].dateStr
  const weekEndStr   = weekDays[6].dateStr
  const prevWeek = new Date(weekStart); prevWeek.setDate(prevWeek.getDate() - 7)
  const nextWeek = new Date(weekStart); nextWeek.setDate(nextWeek.getDate() + 7)
  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

  // ── Counselor Dashboard ───────────────────────────────────────
  if (req.session.userType === 'counselor') {
    const cId      = req.session.counselorId
    const me       = counselors.find(c => c.id === cId) || {}
    const myApts   = appointments.filter(a => a.counselorId === cId)
    const myScheds = schedules.filter(s => s.counselorId === cId)

    const weekMyApts = myApts.filter(a =>
      a.date >= weekStartStr && a.date <= weekEndStr && a.status !== 'cancelled'
    )

    const myCalendarGrid = HOURS.map(h => weekDays.map(day => ({
      schedules:    myScheds.filter(s =>
        s.dayOfWeek === day.schedDayOfWeek && s.isActive &&
        parseInt(s.startTime.split(':')[0]) <= h &&
        parseInt(s.endTime.split(':')[0])   >  h
      ),
      appointments: weekMyApts.filter(a =>
        a.date === day.dateStr && a.time && parseInt(a.time.split(':')[0]) === h
      ),
    })))

    const total     = myApts.length
    const pending   = myApts.filter(a => a.status === 'pending').length
    const confirmed = myApts.filter(a => a.status === 'confirmed').length
    const completed = myApts.filter(a => a.status === 'completed').length
    const todayApts = myApts.filter(a => a.date === todayStr && a.status !== 'cancelled').length
    const doneCount = myApts.filter(a => a.status !== 'cancelled').length
    const confirmRate  = doneCount ? Math.round((confirmed + completed) / doneCount * 100) : 0
    const completeRate = doneCount ? Math.round(completed / doneCount * 100) : 0

    const recentMyApts = [...myApts]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 8)

    const surveys       = readJSON(path.join(dataDir, 'surveys.json'), [])
    const mySurveys      = surveys.filter(s => s.counselorId === cId && typeof s.rating === 'number')
    const myAvgRating    = mySurveys.length > 0
      ? mySurveys.reduce((sum, s) => sum + s.rating, 0) / mySurveys.length
      : 0
    const myAvgSatisfaction = Math.round(myAvgRating / 5 * 100)

    return res.render('admin/dashboard', {
      page: 'dashboard',
      title: 'แดชบอร์ด',
      isCounselorUser: true,
      me,
      myStats: {
        total, pending, confirmed, completed, todayApts, confirmRate, completeRate,
        totalSurveys:    mySurveys.length,
        avgRating:       myAvgRating.toFixed(1),
        avgSatisfaction: myAvgSatisfaction,
      },
      recentMyApts,
      weekDays,
      myCalendarGrid,
      HOURS,
      prevWeekStr: fmtDate(prevWeek),
      nextWeekStr: fmtDate(nextWeek),
      weekStartStr,
      weekEndStr,
      todayStr,
    })
  }

  // ── Admin Dashboard ───────────────────────────────────────────
  const clients  = readData('clients.json')
  const contacts = readData('contacts.json')
  const surveysPath = require('path').join(dataDir, 'surveys.json')
  const surveys = require('fs').existsSync(surveysPath) ? readData('surveys.json') : []

  // Live rates
  const nonCancelled = appointments.filter(a => a.status !== 'cancelled').length
  const confirmedOrDone = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length
  const confirmRate = nonCancelled > 0 ? Math.round(confirmedOrDone / nonCancelled * 100) : 0

  const ratedSurveys = surveys.filter(s => typeof s.rating === 'number')
  const avgRating = ratedSurveys.length > 0
    ? (ratedSurveys.reduce((sum, s) => sum + s.rating, 0) / ratedSurveys.length)
    : 0
  const avgSatisfaction = Math.round(avgRating / 5 * 100)

  // Last 14 days chart data
  const today14 = new Date()
  const chartDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today14)
    d.setDate(d.getDate() - (13 - i))
    const dateStr = fmtDate(d)
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      dateStr,
      pending:   appointments.filter(a => a.date === dateStr && a.status === 'pending').length,
      confirmed: appointments.filter(a => a.date === dateStr && a.status === 'confirmed').length,
      completed: appointments.filter(a => a.date === dateStr && a.status === 'completed').length,
    }
  })

  // ผู้รับบริการที่รอโอนย้าย: มีนัดหมายรอยืนยัน/ยืนยันแล้วผูกกับนักจิตวิทยาที่ถูกระงับ/ลาออก
  const inactiveCounselorIds = new Set(counselors.filter(c => c.status === 'inactive').map(c => c.id))
  const pendingTransferClients = new Set(
    appointments
      .filter(a => (a.status === 'pending' || a.status === 'confirmed') && inactiveCounselorIds.has(a.counselorId))
      .map(a => a.clientId)
  ).size

  const stats = {
    totalCounselors:     counselors.filter(c => c.isApproved).length,
    pendingApproval:     counselors.filter(c => !c.isApproved).length,
    totalClients:        clients.length,
    activeClients:       clients.filter(c => c.status === 'active').length,
    totalAppointments:   appointments.length,
    pendingAppointments: appointments.filter(a => a.status === 'pending').length,
    newContacts:         contacts.filter(c => c.status === 'new').length,
    pendingTransferClients,
    confirmRate,
    avgSatisfaction,
    avgRating:           avgRating.toFixed(1),
    totalSurveys:        ratedSurveys.length,
    chartDays,
  }

  const recentAppointments = appointments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  const weekAppointments = appointments.filter(a =>
    a.date >= weekStartStr && a.date <= weekEndStr && a.status !== 'cancelled'
  )

  const PALETTE       = ['#6366f1','#05967e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#10b981','#f43f5e']
  const LIGHT_PALETTE = ['#e0e7ff','#d1fae5','#fef3c7','#fee2e2','#cffafe','#ede9fe','#d1fae5','#ffe4e6']
  const counselorColors = {}
  counselors.filter(c => c.isApproved).forEach((c, i) => {
    counselorColors[c.id] = {
      color: PALETTE[i % PALETTE.length],
      light: LIGHT_PALETTE[i % LIGHT_PALETTE.length],
    }
  })

  const counselorMap = {}
  counselors.forEach(c => { counselorMap[c.id] = c })

  const calendarGrid = HOURS.map(h => weekDays.map(day => ({
    schedules:    schedules.filter(s =>
      s.dayOfWeek === day.schedDayOfWeek && s.isActive &&
      parseInt(s.startTime.split(':')[0]) <= h &&
      parseInt(s.endTime.split(':')[0])   >  h
    ),
    appointments: weekAppointments.filter(a =>
      a.date === day.dateStr && a.time && parseInt(a.time.split(':')[0]) === h
    ),
  })))

  res.render('admin/dashboard', {
    page: 'dashboard',
    title: 'แดชบอร์ด',
    stats,
    recentAppointments,
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
