const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')

const scheduleFile  = path.join(__dirname, '../../../data/schedules.json')
const counselorFile = path.join(__dirname, '../../../data/counselors.json')

const DAY_NAMES = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']

function readSchedules()   { return JSON.parse(fs.readFileSync(scheduleFile,  'utf8')) }
function readCounselors()  { return JSON.parse(fs.readFileSync(counselorFile, 'utf8')) }
function writeSchedules(d) { fs.writeFileSync(scheduleFile, JSON.stringify(d, null, 2)) }

function isCounselor(req) {
  return req.session.userType === 'counselor'
}

function canUseCounselor(req, counselorId) {
  return !isCounselor(req) || counselorId === req.session.counselorId
}

function forbidden(res) {
  return res.status(403).send('Forbidden')
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  let counselors = readCounselors().filter(c => c.isApproved)
  const schedules  = readSchedules()

  // Counselors only see their own schedule
  let selected = req.query.counselorId || counselors[0]?.id
  if (req.session.userType === 'counselor') {
    selected   = req.session.counselorId
    counselors = counselors.filter(c => c.id === selected)
  }
  const mySchedules = schedules
    .filter(s => s.counselorId === selected)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  // Which days are already added for this counselor?
  const usedDays = mySchedules.map(s => s.dayOfWeek)
  const availableDays = DAY_NAMES
    .map((name, i) => ({ dayOfWeek: i, dayName: name }))
    .filter(d => !usedDays.includes(d.dayOfWeek))

  res.render('admin/schedules', {
    page: 'schedules', title: 'จัดการตารางเวลา',
    counselors, selected, mySchedules, availableDays,
    query: req.query,
  })
})

// ── CREATE / UPDATE (upsert by counselorId + dayOfWeek) ───────────────────────
router.post('/save', (req, res) => {
  const { counselorId, dayOfWeek, startTime, endTime, isActive } = req.body
  if (!canUseCounselor(req, counselorId)) return forbidden(res)

  const targetCounselorId = isCounselor(req) ? req.session.counselorId : counselorId
  const schedules = readSchedules()
  const idx = schedules.findIndex(
    s => s.counselorId === targetCounselorId && s.dayOfWeek == dayOfWeek
  )
  const entry = {
    counselorId: targetCounselorId,
    dayOfWeek:  parseInt(dayOfWeek),
    dayName:    DAY_NAMES[parseInt(dayOfWeek)],
    startTime,
    endTime,
    isActive:   isActive === 'true',
  }
  if (idx !== -1) schedules[idx] = entry
  else            schedules.push(entry)
  writeSchedules(schedules)
  res.redirect(`/admin/schedules?counselorId=${targetCounselorId}&saved=1`)
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/delete', (req, res) => {
  const { counselorId, dayOfWeek } = req.body
  if (!canUseCounselor(req, counselorId)) return forbidden(res)

  const targetCounselorId = isCounselor(req) ? req.session.counselorId : counselorId
  writeSchedules(
    readSchedules().filter(
      s => !(s.counselorId === targetCounselorId && s.dayOfWeek == dayOfWeek)
    )
  )
  res.redirect(`/admin/schedules?counselorId=${targetCounselorId}&deleted=1`)
})

// ── LEGACY (keep old /update working if anything still calls it) ───────────────
router.post('/update', (req, res) => {
  const { counselorId, dayOfWeek, startTime, endTime, isActive } = req.body
  if (!canUseCounselor(req, counselorId)) return forbidden(res)

  const targetCounselorId = isCounselor(req) ? req.session.counselorId : counselorId
  const schedules = readSchedules()
  const idx = schedules.findIndex(
    s => s.counselorId === targetCounselorId && s.dayOfWeek == dayOfWeek
  )
  const entry = {
    counselorId: targetCounselorId,
    dayOfWeek:  parseInt(dayOfWeek),
    dayName:    DAY_NAMES[parseInt(dayOfWeek)],
    startTime, endTime,
    isActive:   isActive === 'true',
  }
  if (idx !== -1) schedules[idx] = entry
  else            schedules.push(entry)
  writeSchedules(schedules)
  res.redirect(`/admin/schedules?counselorId=${targetCounselorId}`)
})

module.exports = router
