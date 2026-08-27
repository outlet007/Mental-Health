function toMin(time) {
  const [hours, minutes] = String(time || '').split(':').map(Number)
  return hours * 60 + minutes
}

function timesOverlap(startA, durationA, startB, durationB) {
  return startA < startB + durationB && startB < startA + durationA
}
function dateDayOfWeek(dateString) {
  const parts = String(dateString || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null
  const [year, month, day] = parts
  return new Date(year, month - 1, day).getDay()
}

function slotDuration(slot) {
  const duration = toMin(slot.endTime) - toMin(slot.startTime)
  return Number.isFinite(duration) && duration > 0 ? duration : 0
}

function validateScheduleSlot(schedules, candidate, excludeScheduleId = '') {
  const duration = slotDuration(candidate)
  const dayOfWeek = Number(candidate.dayOfWeek)
  if (!candidate.counselorId || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !duration) {
    return { ok: false, error: 'invalid' }
  }

  const start = toMin(candidate.startTime)
  const overlap = schedules.some(slot =>
    slot.id !== excludeScheduleId &&
    slot.counselorId === candidate.counselorId &&
    Number(slot.dayOfWeek) === dayOfWeek &&
    timesOverlap(start, duration, toMin(slot.startTime), slotDuration(slot))
  )

  return overlap ? { ok: false, error: 'overlap' } : { ok: true, duration }
}

function validateScheduleBatch(schedules, entries, excludeScheduleId = '') {
  if (!Array.isArray(entries) || entries.length === 0) return { ok: false, error: 'invalid' }

  const staged = schedules.filter(slot => slot.id !== excludeScheduleId)
  for (const entry of entries) {
    const validation = validateScheduleSlot(staged, entry)
    if (!validation.ok) return validation
    staged.push(entry)
  }
  return { ok: true }
}
function listAvailableSlots({ schedules, appointments, counselorId, date, excludeAppointmentId = '' }) {
  const dayOfWeek = dateDayOfWeek(date)
  if (dayOfWeek === null) return []

  const booked = appointments
    .filter(appointment =>
      appointment.id !== excludeAppointmentId &&
      appointment.counselorId === counselorId &&
      appointment.date === date &&
      appointment.status !== 'cancelled'
    )
    .map(appointment => ({
      start: toMin(appointment.time),
      duration: Number(appointment.duration) || 0,
    }))

  return schedules
    .filter(slot =>
      slot.counselorId === counselorId &&
      Number(slot.dayOfWeek) === dayOfWeek &&
      slot.isActive &&
      slotDuration(slot) > 0
    )
    .sort((left, right) => left.startTime.localeCompare(right.startTime))
    .map(slot => {
      const duration = slotDuration(slot)
      const start = toMin(slot.startTime)
      return {
        id: slot.id,
        time: slot.startTime,
        endTime: slot.endTime,
        duration,
        available: !booked.some(appointment =>
          timesOverlap(start, duration, appointment.start, appointment.duration)
        ),
      }
    })
}

function findAvailableSlot(options, time) {
  return listAvailableSlots(options).find(slot => slot.time === time && slot.available) || null
}

module.exports = {
  toMin,
  timesOverlap,
  dateDayOfWeek,
  findAvailableSlot,
  listAvailableSlots,
  slotDuration,
  validateScheduleSlot,
  validateScheduleBatch,
}