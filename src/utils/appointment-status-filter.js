const APPOINTMENT_STATUSES = new Set(['pending', 'confirmed', 'completed', 'cancelled', 'all'])

function resolveAppointmentStatusFilter(value, isCounselor = false) {
  const requested = APPOINTMENT_STATUSES.has(value) ? value : 'confirmed'
  return isCounselor && requested === 'pending' ? 'confirmed' : requested
}

function filterAppointmentsByStatus(appointments, status, isCounselor = false) {
  if (status === 'all') {
    return isCounselor ? appointments.filter(item => item.status !== 'pending') : appointments
  }
  return appointments.filter(item => item.status === status)
}

module.exports = { filterAppointmentsByStatus, resolveAppointmentStatusFilter }
