const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const { logDeletion } = require('../../utils/audit-log')

const scheduleFile  = path.join(__dirname, '../../../data/schedules.json')
const counselorFile = path.join(__dirname, '../../../data/counselors.json')

const DAY_NAMES = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
const COLORS    = ['#6366f1','#05967e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#10b981','#f43f5e']

function readSchedules()   { return JSON.parse(fs.readFileSync(scheduleFile,  'utf8')) }
function readCounselors()  { return JSON.parse(fs.readFileSync(counselorFile, 'utf8')) }
function writeSchedules(d) { fs.writeFileSync(scheduleFile, JSON.stringify(d, null, 2)) }
function isCounselor(req)  { return req.session.userType === 'counselor' }
function canUseCounselor(req, cId) { return !isCounselor(req) || cId === req.session.counselorId }
function forbidden(res)    { return res.status(403).send('Forbidden') }

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  let counselors   = readCounselors().filter(c => c.isApproved)
  const allSched   = readSchedules()

  const view = req.query.view || 'week'
  let filterCId    = req.query.counselorId !== undefined ? req.query.counselorId : ''
  const selectedDay = req.query.dayOfWeek !== undefined ? parseInt(req.query.dayOfWeek) : 1

  // Counselors only see their own
  if (isCounselor(req)) {
    filterCId  = req.session.counselorId
    counselors = counselors.filter(c => c.id === filterCId)
  }

  // Schedules filtered by counselor (empty = all)
  const filtered = filterCId
    ? allSched.filter(s => s.counselorId === filterCId)
    : allSched

  // Keep "selected" for modal (add/edit panel still needs a single counselor)
  const selected = filterCId || counselors[0]?.id
  const mySchedules = allSched
    .filter(s => s.counselorId === selected)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  const usedDays = mySchedules.map(s => s.dayOfWeek)
  const availableDays = DAY_NAMES
    .map((name, i) => ({ dayOfWeek: i, dayName: name }))
    .filter(d => !usedDays.includes(d.dayOfWeek))

  // Counselor color map
  const counselorColors = {}
  counselors.forEach((c, i) => { counselorColors[c.id] = COLORS[i % COLORS.length] })

  // ── Week grid: days 0-6, each with matching schedules + counselor info
  const counselorMap = {}
  counselors.forEach(c => { counselorMap[c.id] = c })

  const weekGrid = DAY_NAMES.map((dayName, dow) => ({
    dow,
    dayName,
    entries: filtered
      .filter(s => s.dayOfWeek === dow)
      .map(s => ({ ...s, counselor: counselorMap[s.counselorId] }))
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
  }))

  // ── Day view
  const daySchedules = filtered
    .filter(s => s.dayOfWeek === selectedDay)
    .map(s => ({ ...s, counselor: counselorMap[s.counselorId] }))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))

  // ── Month view
  const now   = new Date()
  const year  = parseInt(req.query.year)  || now.getFullYear()
  const month = parseInt(req.query.month) || (now.getMonth() + 1)

  const firstDay  = new Date(year, month - 1, 1)
  const lastDay   = new Date(year, month, 0)
  const prevDate  = new Date(year, month - 2, 1)
  const nextDate  = new Date(year, month, 1)

  const weeks = []
  let week = Array(firstDay.getDay()).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dow      = new Date(year, month - 1, d).getDay()
    const entries  = filtered
      .filter(s => s.dayOfWeek === dow && s.isActive)
      .map(s => ({ ...s, counselor: counselorMap[s.counselorId] }))
    const isToday  = d === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear()
    week.push({ day: d, dow, entries, isToday })
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  const MONTH_NAMES_TH = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']

  const monthData = {
    year, month, weeks,
    monthName: MONTH_NAMES_TH[month],
    prevYear: prevDate.getFullYear(), prevMonth: prevDate.getMonth() + 1,
    nextYear: nextDate.getFullYear(), nextMonth: nextDate.getMonth() + 1,
  }

  res.render('admin/schedules', {
    page: 'schedules', title: 'จัดการตารางเวลา',
    counselors, counselorMap, counselorColors,
    selected, filterCId,
    mySchedules, availableDays,
    view, selectedDay,
    weekGrid, daySchedules, monthData,
    isCounselorUser: isCounselor(req),
    query: req.query,
  })
})

// ── CREATE / UPDATE ───────────────────────────────────────────────────────────
router.post('/save', (req, res) => {
  const { counselorId, dayOfWeek, startTime, endTime, isActive } = req.body
  if (!canUseCounselor(req, counselorId)) return forbidden(res)

  const cId      = isCounselor(req) ? req.session.counselorId : counselorId
  const schedules = readSchedules()
  const idx = schedules.findIndex(s => s.counselorId === cId && s.dayOfWeek == dayOfWeek)
  const entry = {
    counselorId: cId,
    dayOfWeek:   parseInt(dayOfWeek),
    dayName:     DAY_NAMES[parseInt(dayOfWeek)],
    startTime, endTime,
    isActive:    isActive === 'true',
  }
  if (idx !== -1) schedules[idx] = entry
  else            schedules.push(entry)
  writeSchedules(schedules)

  const back = new URLSearchParams(req.body.returnQuery || '').toString()
  res.redirect(`/admin/schedules?${back}&saved=1`)
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/delete', (req, res) => {
  const { counselorId, dayOfWeek } = req.body
  if (!canUseCounselor(req, counselorId)) return forbidden(res)

  const cId       = isCounselor(req) ? req.session.counselorId : counselorId
  const counselor = readCounselors().find(c => c.id === cId)
  writeSchedules(readSchedules().filter(
    s => !(s.counselorId === cId && s.dayOfWeek == dayOfWeek)
  ))
  logDeletion({
    entityType: 'schedule',
    entityId:   `${cId}-${dayOfWeek}`,
    entityName: `${DAY_NAMES[dayOfWeek]}${counselor ? ' ของ ' + counselor.name : ''}`,
    reason:     req.body.reason,
    req,
  })
  const back = new URLSearchParams(req.body.returnQuery || '').toString()
  res.redirect(`/admin/schedules?${back}&deleted=1`)
})

// ── LEGACY ────────────────────────────────────────────────────────────────────
router.post('/update', (req, res) => {
  const { counselorId, dayOfWeek, startTime, endTime, isActive } = req.body
  if (!canUseCounselor(req, counselorId)) return forbidden(res)
  const cId = isCounselor(req) ? req.session.counselorId : counselorId
  const schedules = readSchedules()
  const idx = schedules.findIndex(s => s.counselorId === cId && s.dayOfWeek == dayOfWeek)
  const entry = { counselorId: cId, dayOfWeek: parseInt(dayOfWeek), dayName: DAY_NAMES[parseInt(dayOfWeek)], startTime, endTime, isActive: isActive === 'true' }
  if (idx !== -1) schedules[idx] = entry
  else schedules.push(entry)
  writeSchedules(schedules)
  res.redirect(`/admin/schedules?counselorId=${cId}`)
})

module.exports = router
