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

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const counselors = readCounselors().filter(c => c.isApproved)
  const schedules  = readSchedules()
  const selected   = req.query.counselorId || counselors[0]?.id
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
  const schedules = readSchedules()
  const idx = schedules.findIndex(
    s => s.counselorId === counselorId && s.dayOfWeek == dayOfWeek
  )
  const entry = {
    counselorId,
    dayOfWeek:  parseInt(dayOfWeek),
    dayName:    DAY_NAMES[parseInt(dayOfWeek)],
    startTime,
    endTime,
    isActive:   isActive === 'true',
  }
  if (idx !== -1) schedules[idx] = entry
  else            schedules.push(entry)
  writeSchedules(schedules)
  res.redirect(`/admin/schedules?counselorId=${counselorId}&saved=1`)
})

// ── DELETE ────────────────────────────────────────────────────────────────────
router.post('/delete', (req, res) => {
  const { counselorId, dayOfWeek } = req.body
  writeSchedules(
    readSchedules().filter(
      s => !(s.counselorId === counselorId && s.dayOfWeek == dayOfWeek)
    )
  )
  res.redirect(`/admin/schedules?counselorId=${counselorId}&deleted=1`)
})

// ── LEGACY (keep old /update working if anything still calls it) ───────────────
router.post('/update', (req, res) => {
  const { counselorId, dayOfWeek, startTime, endTime, isActive } = req.body
  const schedules = readSchedules()
  const idx = schedules.findIndex(
    s => s.counselorId === counselorId && s.dayOfWeek == dayOfWeek
  )
  const entry = {
    counselorId,
    dayOfWeek:  parseInt(dayOfWeek),
    dayName:    DAY_NAMES[parseInt(dayOfWeek)],
    startTime, endTime,
    isActive:   isActive === 'true',
  }
  if (idx !== -1) schedules[idx] = entry
  else            schedules.push(entry)
  writeSchedules(schedules)
  res.redirect(`/admin/schedules?counselorId=${counselorId}`)
})

module.exports = router
