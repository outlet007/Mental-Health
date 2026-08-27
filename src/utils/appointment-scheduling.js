const { listAvailableSlots, timesOverlap, toMin } = require('./availability')

// Reassigns an appointment to a new counselor, keeping its date/time fixed.
// Mutates the appointments array in place on success. Callers own persistence and notifications.
function reassignAppointmentCounselor(appointments, idx, newCounselorId, counselors, schedules) {
  const current = appointments[idx]
  const newCounselor = counselors.find(c => c.id === newCounselorId)
  if (!newCounselor) return { ok: false, error: 'invalid' }

  if (newCounselorId === current.counselorId) return { ok: true, changed: false }

  const matchingSlot = listAvailableSlots({
    schedules,
    appointments,
    counselorId: newCounselorId,
    date: current.date,
    excludeAppointmentId: current.id,
  }).find(slot => slot.time === current.time)

  if (!matchingSlot) return { ok: false, error: 'slot' }
  if (!matchingSlot.available) return { ok: false, error: 'conflict' }

  const oldCounselor = counselors.find(c => c.id === current.counselorId)

  appointments[idx].counselorId   = newCounselorId
  appointments[idx].counselorName = newCounselor.name
  appointments[idx].duration      = matchingSlot.duration

  return { ok: true, changed: true, oldCounselor, newCounselor }
}

module.exports = { toMin, timesOverlap, reassignAppointmentCounselor }
