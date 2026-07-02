function toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

// True if [startA, startA+durationA) and [startB, startB+durationB) intersect.
function timesOverlap(startA, durationA, startB, durationB) {
  return startA < startB + durationB && startB < startA + durationA
}

// Reassigns appointments[idx] to a new counselor, keeping its date/time fixed.
// Mutates `appointments` in place on success. Does not read/write files or send email —
// callers own persistence and notification so they can batch multiple reassignments.
function reassignAppointmentCounselor(appointments, idx, newCounselorId, counselors) {
  const current = appointments[idx]
  const newCounselor = counselors.find(c => c.id === newCounselorId)
  if (!newCounselor) return { ok: false, error: 'invalid' }

  if (newCounselorId === current.counselorId) return { ok: true, changed: false }

  const duration = newCounselor.sessionDuration || current.duration || 60
  const startMin = toMin(current.time)

  const conflict = appointments.some((a, i) =>
    i !== idx &&
    a.counselorId === newCounselorId &&
    a.date === current.date &&
    a.status !== 'cancelled' &&
    timesOverlap(toMin(a.time), a.duration || duration, startMin, duration)
  )
  if (conflict) return { ok: false, error: 'conflict' }

  const oldCounselor = counselors.find(c => c.id === current.counselorId)

  appointments[idx].counselorId   = newCounselorId
  appointments[idx].counselorName = newCounselor.name
  appointments[idx].duration      = duration

  return { ok: true, changed: true, oldCounselor, newCounselor }
}

module.exports = { toMin, timesOverlap, reassignAppointmentCounselor }
