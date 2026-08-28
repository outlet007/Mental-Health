const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

const {
  findAvailableSlot,
  listAvailableSlots,
  slotDuration,
  validateScheduleSlot,
  validateScheduleBatch,
} = require('../src/utils/availability')
const { reassignAppointmentCounselor } = require('../src/utils/appointment-scheduling')

const schedules = [
  { id: 'slot-1', counselorId: 'c1', dayOfWeek: 1, startTime: '09:00', endTime: '09:45', isActive: true },
  { id: 'slot-2', counselorId: 'c1', dayOfWeek: 1, startTime: '10:15', endTime: '11:15', isActive: true },
  { id: 'slot-off', counselorId: 'c1', dayOfWeek: 1, startTime: '13:00', endTime: '14:00', isActive: false },
]

test('explicit slots own their duration and may have different lengths on the same day', () => {
  const slots = listAvailableSlots({
    schedules,
    appointments: [],
    counselorId: 'c1',
    date: '2026-08-31',
  })

  assert.deepEqual(slots, [
    { id: 'slot-1', time: '09:00', endTime: '09:45', duration: 45, available: true },
    { id: 'slot-2', time: '10:15', endTime: '11:15', duration: 60, available: true },
  ])
  assert.equal(slotDuration(schedules[0]), 45)
})

test('booked appointments disable only overlapping explicit slots', () => {
  const slots = listAvailableSlots({
    schedules,
    appointments: [
      { id: 'a1', counselorId: 'c1', date: '2026-08-31', time: '09:30', duration: 30, status: 'confirmed' },
    ],
    counselorId: 'c1',
    date: '2026-08-31',
  })

  assert.equal(slots[0].available, false)
  assert.equal(slots[1].available, true)
  assert.equal(findAvailableSlot({
    schedules,
    appointments: [],
    counselorId: 'c1',
    date: '2026-08-31',
  }, '10:15').duration, 60)
})

test('schedule validation rejects invalid and overlapping slots but permits adjacent slots', () => {
  assert.deepEqual(validateScheduleSlot(schedules, {
    counselorId: 'c1', dayOfWeek: 1, startTime: '09:30', endTime: '10:30',
  }), { ok: false, error: 'overlap' })

  assert.deepEqual(validateScheduleSlot(schedules, {
    counselorId: 'c1', dayOfWeek: 1, startTime: '09:45', endTime: '10:15',
  }), { ok: true, duration: 30 })

  assert.deepEqual(validateScheduleSlot(schedules, {
    counselorId: 'c1', dayOfWeek: 1, startTime: '11:00', endTime: '10:00',
  }), { ok: false, error: 'invalid' })
})
test('reassignment requires a matching explicit slot and adopts that slot duration', () => {
  const appointments = [
    { id: 'a1', counselorId: 'c1', counselorName: 'One', date: '2026-08-31', time: '09:00', duration: 60, status: 'confirmed' },
  ]
  const counselors = [{ id: 'c1', name: 'One' }, { id: 'c2', name: 'Two' }]
  const targetSchedules = [
    { id: 'slot-c2', counselorId: 'c2', dayOfWeek: 1, startTime: '09:00', endTime: '09:30', isActive: true },
  ]

  const result = reassignAppointmentCounselor(appointments, 0, 'c2', counselors, targetSchedules)
  assert.equal(result.ok, true)
  assert.equal(appointments[0].counselorId, 'c2')
  assert.equal(appointments[0].duration, 30)

  const noSlot = reassignAppointmentCounselor(appointments, 0, 'c1', counselors, targetSchedules)
  assert.deepEqual(noSlot, { ok: false, error: 'slot' })
})
test('batch validation is atomic and rejects ranges that overlap each other', () => {
  const existing = [
    { id: 'saved', counselorId: 'c1', dayOfWeek: 1, startTime: '08:00', endTime: '09:00', isActive: true },
  ]
  const validBatch = [
    { id: 'new-1', counselorId: 'c1', dayOfWeek: 1, startTime: '09:00', endTime: '09:30', isActive: true },
    { id: 'new-2', counselorId: 'c1', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', isActive: true },
  ]
  assert.deepEqual(validateScheduleBatch(existing, validBatch), { ok: true })
  assert.equal(existing.length, 1, 'validation must not mutate persisted schedules')

  const overlappingBatch = [
    ...validBatch,
    { id: 'new-3', counselorId: 'c1', dayOfWeek: 1, startTime: '10:30', endTime: '11:30', isActive: true },
  ]
  assert.deepEqual(validateScheduleBatch(existing, overlappingBatch), { ok: false, error: 'overlap' })
  assert.equal(existing.length, 1, 'a rejected batch must leave persisted schedules untouched')
})

test('schedule modal supports multiple days and ranges with the requested button labels', () => {
  const viewSource = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'schedules.ejs'), 'utf8')
  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', 'schedules.js'), 'utf8')

  assert.match(viewSource, /name="timeRanges" id="f_timeRanges"/)
  assert.match(viewSource, /name="dayOfWeeks" id="f_dayOfWeeks"/)
  assert.match(viewSource, /class="schedule-day-checkbox"/)
  assert.doesNotMatch(viewSource, /type="time"/)
  assert.match(viewSource, /data-field="startHour"/)
  assert.match(viewSource, /data-field="startMinute"/)
  assert.match(viewSource, /data-field="endHour"/)
  assert.match(viewSource, /data-field="endMinute"/)
  assert.ok(viewSource.includes('เวลาเริ่ม (24 ชั่วโมง)'))
  assert.ok(viewSource.includes('function combineTime(row, prefix)'))
  assert.match(viewSource, /function readSelectedDays\(\)/)
  assert.match(viewSource, /id="addTimeRangeButton"[^>]*onclick="addTimeRange\(\)"/)
  assert.match(viewSource, /เพิ่มช่วงเวลา/)
  assert.match(viewSource, /บันทึกตารางเวลา/)
  assert.match(viewSource, /\+ เพิ่มตารางเวลา/)
  assert.doesNotMatch(viewSource, /\+ เพิ่ม slot เวลา/)
  assert.match(routeSource, /JSON\.parse\(timeRanges\)/)
  assert.match(routeSource, /JSON\.parse\(dayOfWeeks\)/)
  assert.match(routeSource, /days\.flatMap\(day => ranges\.map/)
  assert.match(routeSource, /validateScheduleBatch\(schedules, entries, existing\?\.id\)/)
  assert.match(routeSource, /schedules\.push\(\.\.\.entries\)/)
})

test('weekly schedule keeps the same grouped-by-day layout when filtering by counselor', () => {
  const viewSource = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'schedules.ejs'), 'utf8')
  const weeklyGridMarkers = viewSource.match(/data-weekly-schedule-grid=.true./g) || []

  assert.equal(weeklyGridMarkers.length, 1, 'weekly view should have one shared grid')
  assert.match(viewSource, /weeklyCounselor \? weeklyCounselor\.name/)
  assert.doesNotMatch(viewSource, /Single counselor week view|mySchedules/)
  assert.doesNotThrow(() => ejs.compile(viewSource))
})

test('booking availability summaries show each active day once without time ranges', () => {
  const viewFiles = [
    'views/admin/appointments.ejs',
    'views/admin/clients.ejs',
    'views/admin/contacts.ejs',
  ]

  viewFiles.forEach(relativePath => {
    const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
    const helperStart = source.indexOf('function renderAvailableDayBadges')
    const helperEnd = source.indexOf("\n  }", helperStart)
    const helper = source.slice(helperStart, helperEnd)

    assert.ok(helperStart >= 0, `${relativePath} must render day-only availability badges`)
    assert.match(helper, /new Map\(schedules\.map\(schedule => \[String\(schedule\.dayOfWeek\), schedule\.dayName\]\)\)/)
    assert.match(helper, /\$\{dayName\}<\/span>/)
    assert.doesNotMatch(helper, /startTime|endTime/)
  })
})
