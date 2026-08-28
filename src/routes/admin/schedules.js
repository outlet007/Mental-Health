const express = require('express')
const router  = express.Router()
const { ensureToken, verifyToken } = require('../../middleware/csrf')
router.use(ensureToken)
router.use(verifyToken)
const path    = require('path')
const crypto  = require('crypto')
const { logDeletion } = require('../../utils/audit-log')
const { readJSON, writeJSON } = require('../../utils/json-store')
const { validateScheduleBatch } = require('../../utils/availability')

const scheduleFile  = path.join(__dirname, '../../../data/schedules.json')
const counselorFile = path.join(__dirname, '../../../data/counselors.json')

const DAY_NAMES = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
const COLORS    = ['#6366f1','#05967e','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#10b981','#f43f5e']

function readSchedules()   { return readJSON(scheduleFile) }
function readCounselors()  { return readJSON(counselorFile) }
function writeSchedules(d) { writeJSON(scheduleFile, d) }
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
    view, selectedDay,
    weekGrid, daySchedules, monthData,
    isCounselorUser: isCounselor(req),
    query: req.query,
  })
})

// ── CREATE / UPDATE ───────────────────────────────────────────────────────────
router.post('/save', (req, res) => {
  const { id, counselorId, dayOfWeek, dayOfWeeks, startTime, endTime, isActive, timeRanges } = req.body
  const schedules = readSchedules()
  const existingIndex = id ? schedules.findIndex(slot => slot.id === id) : -1
  const existing = existingIndex === -1 ? null : schedules[existingIndex]

  if (id && !existing) return res.redirect('/admin/schedules?error=invalid_slot')
  if (existing && !canUseCounselor(req, existing.counselorId)) return forbidden(res)

  const cId = isCounselor(req) ? req.session.counselorId : counselorId
  if (!canUseCounselor(req, cId)) return forbidden(res)
  if (!readCounselors().some(counselor => counselor.id === cId)) {
    return res.redirect('/admin/schedules?error=invalid')
  }

  let ranges = [{ startTime, endTime }]
  if (timeRanges) {
    try {
      ranges = JSON.parse(timeRanges)
    } catch {
      ranges = []
    }
  }
  if (!Array.isArray(ranges) || ranges.length === 0 || ranges.length > 20 || (existing && ranges.length !== 1)) {
    return res.redirect('/admin/schedules?error=invalid')
  }

  let days = [parseInt(dayOfWeek)]
  if (dayOfWeeks) {
    try {
      days = JSON.parse(dayOfWeeks)
    } catch {
      days = []
    }
  }
  days = [...new Set(Array.isArray(days) ? days.map(Number) : [])]
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  if (days.length === 0 || (existing && days.length !== 1) || days.length * ranges.length > 140) {
    return res.redirect('/admin/schedules?error=invalid')
  }

  const entries = days.flatMap(day => ranges.map(range => ({
    id: existing?.id || 'slot-' + crypto.randomUUID(),
    counselorId: cId,
    dayOfWeek: day,
    dayName: DAY_NAMES[day],
    startTime: String(range?.startTime || ''),
    endTime: String(range?.endTime || ''),
    isActive: isActive === 'true',
  })))

  // Validate against saved slots and earlier rows in this same request.
  // Nothing is persisted until the whole batch passes.
  const validation = validateScheduleBatch(schedules, entries, existing?.id)
  if (!validation.ok) {
    const back = new URLSearchParams(req.body.returnQuery || '').toString()
    return res.redirect('/admin/schedules?' + (back ? back + '&' : '') + 'error=' + validation.error)
  }

  if (existingIndex === -1) schedules.push(...entries)
  else schedules[existingIndex] = entries[0]
  writeSchedules(schedules)

  const back = new URLSearchParams(req.body.returnQuery || '').toString()
  res.redirect('/admin/schedules?' + (back ? back + '&' : '') + 'saved=' + entries.length)
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/delete', (req, res) => {
  const schedules = readSchedules()
  const slot = schedules.find(entry => entry.id === req.body.id)
  if (!slot) return res.redirect('/admin/schedules?error=invalid_slot')
  if (!canUseCounselor(req, slot.counselorId)) return forbidden(res)

  const counselor = readCounselors().find(c => c.id === slot.counselorId)
  writeSchedules(schedules.filter(entry => entry.id !== slot.id))
  logDeletion({
    entityType: 'schedule',
    entityId: slot.id,
    entityName: slot.dayName + ' ' + slot.startTime + '–' + slot.endTime + (counselor ? ' ของ ' + counselor.name : ''),
    reason: req.body.reason,
    req,
  })
  const back = new URLSearchParams(req.body.returnQuery || '').toString()
  res.redirect('/admin/schedules?' + back + '&deleted=1')
})

module.exports = router
