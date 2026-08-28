const crypto = require('crypto')

const CASE_STATUS = Object.freeze({ ACTIVE: 'active', CLOSED: 'closed' })
const RISK_LEVELS = Object.freeze(['none', 'low', 'moderate', 'high', 'critical'])
const CASE_DISPOSITIONS = Object.freeze(['follow_up', 'closed'])
const CASE_CODE_PATTERN = /^CASE-(\d+)$/i
const LEGACY_APPOINTMENT_PATTERN = /^app-(\d+)-(\d+)$/i

function formatCaseCode(sequence) {
  return `CASE-${String(sequence).padStart(4, '0')}`
}

function caseCodeSequence(caseCode) {
  const match = String(caseCode || '').match(CASE_CODE_PATTERN)
  return match ? Number.parseInt(match[1], 10) : 0
}

function nextCaseCode(cases) {
  const maxSequence = cases.reduce(
    (max, record) => Math.max(max, caseCodeSequence(record.caseCode)),
    0
  )
  return formatCaseCode(maxSequence + 1)
}

function isCaseCodeAvailable(cases, caseCode, caseId = '') {
  return !cases.some(record =>
    String(record.caseCode || '').toUpperCase() === String(caseCode || '').toUpperCase()
    && record.id !== caseId
  )
}

function createCase(cases, { clientId, openedAt, concern = '', caseCode = '' }) {
  const createdAt = new Date().toISOString()
  const requestedCode = String(caseCode || '').toUpperCase()
  const record = {
    id: `case-${crypto.randomUUID()}`,
    caseCode: CASE_CODE_PATTERN.test(requestedCode) && isCaseCodeAvailable(cases, requestedCode)
      ? requestedCode
      : nextCaseCode(cases),
    clientId,
    status: CASE_STATUS.ACTIVE,
    openedAt: openedAt || createdAt.slice(0, 10),
    primaryConcern: String(concern || '').trim(),
    closedAt: '',
    closedReason: '',
    createdAt,
  }
  cases.push(record)
  return record
}

function findActiveCase(cases, clientId) {
  return cases
    .filter(item => item.clientId === clientId && item.status !== CASE_STATUS.CLOSED)
    .sort((a, b) => String(b.openedAt || b.createdAt || '').localeCompare(String(a.openedAt || a.createdAt || '')))[0] || null
}

function ensureActiveCase(cases, details) {
  const existing = findActiveCase(cases, details.clientId)
  return existing || createCase(cases, details)
}

function closeCase(cases, caseId, { closedAt, reason = '' } = {}) {
  const record = cases.find(item => item.id === caseId)
  if (!record) return null
  record.status = CASE_STATUS.CLOSED
  record.closedAt = closedAt || new Date().toISOString().slice(0, 10)
  record.closedReason = String(reason || '').trim()
  return record
}

function normalizeRiskLevel(value) {
  return RISK_LEVELS.includes(value) ? value : 'none'
}

function normalizeDisposition(value) {
  return CASE_DISPOSITIONS.includes(value) ? value : 'follow_up'
}

function appointmentOrder(a, b) {
  return `${a.date || ''}T${a.time || ''}|${a.createdAt || ''}|${a.id || ''}`
    .localeCompare(`${b.date || ''}T${b.time || ''}|${b.createdAt || ''}|${b.id || ''}`)
}

function legacyAppointmentParts(appointmentId) {
  const match = String(appointmentId || '').match(LEGACY_APPOINTMENT_PATTERN)
  if (!match) return null
  return {
    caseSequence: Number.parseInt(match[1], 10),
    visitNumber: Number.parseInt(match[2], 10),
  }
}

function formatAppointmentNumber(caseCode, visitNumber) {
  return `${caseCode}-${String(visitNumber).padStart(2, '0')}`
}

function displayAppointmentNumber(appointment) {
  return appointment?.appointmentNumber || appointment?.id || ''
}

function caseForAppointmentDate(cases, appointment) {
  const date = String(appointment.date || appointment.createdAt || '')
  return cases
    .filter(record => record.clientId === appointment.clientId)
    .filter(record => !record.openedAt || record.openedAt <= date)
    .filter(record => record.status !== CASE_STATUS.CLOSED || !record.closedAt || date <= record.closedAt)
    .sort((a, b) => String(b.openedAt || b.createdAt || '').localeCompare(String(a.openedAt || a.createdAt || '')))[0]
    || findActiveCase(cases, appointment.clientId)
    || null
}

function ensureCaseAndAppointmentNumbers(cases, appointments) {
  let casesChanged = false
  let appointmentsChanged = false
  const casesById = new Map(cases.map(record => [record.id, record]))
  const legacyGroups = new Map()

  for (const appointment of appointments) {
    const legacy = legacyAppointmentParts(appointment.id)
    if (!legacy) continue
    const key = `${appointment.clientId || appointment.clientName || ''}|${legacy.caseSequence}`
    if (!legacyGroups.has(key)) legacyGroups.set(key, { ...legacy, appointments: [] })
    legacyGroups.get(key).appointments.push(appointment)
  }

  const orderedLegacyGroups = [...legacyGroups.values()]
    .sort((a, b) => a.caseSequence - b.caseSequence)

  for (const group of orderedLegacyGroups) {
    const preferredCode = formatCaseCode(group.caseSequence)
    let record = group.appointments
      .map(appointment => casesById.get(appointment.caseId))
      .find(Boolean)

    if (!record) {
      const first = [...group.appointments].sort(appointmentOrder)[0]
      record = createCase(cases, {
        clientId: first.clientId,
        openedAt: first.date || first.createdAt,
        concern: first.concern || '',
        caseCode: preferredCode,
      })
      casesById.set(record.id, record)
      casesChanged = true
    } else if (!record.caseCode) {
      record.caseCode = isCaseCodeAvailable(cases, preferredCode, record.id)
        ? preferredCode
        : nextCaseCode(cases)
      casesChanged = true
    }

    for (const appointment of group.appointments) {
      if (appointment.caseId !== record.id) {
        appointment.caseId = record.id
        appointmentsChanged = true
      }
    }
  }

  for (const record of [...cases].sort((a, b) =>
    String(a.openedAt || a.createdAt || a.id).localeCompare(String(b.openedAt || b.createdAt || b.id))
  )) {
    const normalizedCode = String(record.caseCode || '').toUpperCase()
    if (!CASE_CODE_PATTERN.test(normalizedCode) || !isCaseCodeAvailable(cases, normalizedCode, record.id)) {
      record.caseCode = nextCaseCode(cases)
      casesChanged = true
    } else if (record.caseCode !== normalizedCode) {
      record.caseCode = normalizedCode
      casesChanged = true
    }
  }

  for (const appointment of [...appointments].sort(appointmentOrder)) {
    if (appointment.caseId && casesById.has(appointment.caseId)) continue
    let record = caseForAppointmentDate(cases, appointment)
    if (!record) {
      record = createCase(cases, {
        clientId: appointment.clientId,
        openedAt: appointment.date || appointment.createdAt,
        concern: appointment.concern || '',
      })
      casesById.set(record.id, record)
      casesChanged = true
    }
    appointment.caseId = record.id
    appointmentsChanged = true
  }

  const appointmentsByCase = new Map()
  for (const appointment of appointments) {
    if (!appointmentsByCase.has(appointment.caseId)) appointmentsByCase.set(appointment.caseId, [])
    appointmentsByCase.get(appointment.caseId).push(appointment)
  }

  for (const [caseId, caseAppointments] of appointmentsByCase) {
    const record = casesById.get(caseId)
    if (!record) continue
    const occupied = new Set()
    const pending = []

    for (const appointment of [...caseAppointments].sort(appointmentOrder)) {
      const legacy = legacyAppointmentParts(appointment.id)
      const requestedVisit = Number.isInteger(appointment.visitNumber) && appointment.visitNumber > 0
        ? appointment.visitNumber
        : legacy?.visitNumber
      if (requestedVisit && !occupied.has(requestedVisit)) {
        if (appointment.visitNumber !== requestedVisit) {
          appointment.visitNumber = requestedVisit
          appointmentsChanged = true
        }
        occupied.add(requestedVisit)
      } else {
        pending.push(appointment)
      }
    }

    let nextVisit = 1
    for (const appointment of pending) {
      while (occupied.has(nextVisit)) nextVisit += 1
      if (appointment.visitNumber !== nextVisit) {
        appointment.visitNumber = nextVisit
        appointmentsChanged = true
      }
      occupied.add(nextVisit)
    }

    for (const appointment of caseAppointments) {
      const appointmentNumber = formatAppointmentNumber(record.caseCode, appointment.visitNumber)
      if (appointment.caseCode !== record.caseCode) {
        appointment.caseCode = record.caseCode
        appointmentsChanged = true
      }
      if (appointment.appointmentNumber !== appointmentNumber) {
        appointment.appointmentNumber = appointmentNumber
        appointmentsChanged = true
      }
    }
  }

  return {
    changed: casesChanged || appointmentsChanged,
    casesChanged,
    appointmentsChanged,
  }
}

function visitTypeByAppointment(appointments) {
  const grouped = new Map()
  for (const appointment of appointments) {
    const key = appointment.caseId || `legacy-client:${appointment.clientId || appointment.clientName || appointment.id}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(appointment)
  }

  const result = new Map()
  for (const rows of grouped.values()) {
    rows.sort(appointmentOrder).forEach((appointment, index) => {
      result.set(appointment.id, index === 0 ? 'new' : 'continuing')
    })
  }
  return result
}

function findNextAppointment(appointments, current) {
  const currentKey = `${current.date || ''}T${current.time || ''}`
  return appointments
    .filter(item => item.id !== current.id)
    .filter(item => item.status !== 'cancelled')
    .filter(item => current.caseId ? item.caseId === current.caseId : item.clientId === current.clientId)
    .filter(item => `${item.date || ''}T${item.time || ''}` > currentKey)
    .sort(appointmentOrder)[0] || null
}

module.exports = {
  CASE_STATUS,
  RISK_LEVELS,
  CASE_DISPOSITIONS,
  formatCaseCode,
  nextCaseCode,
  formatAppointmentNumber,
  displayAppointmentNumber,
  legacyAppointmentParts,
  ensureCaseAndAppointmentNumbers,
  createCase,
  findActiveCase,
  ensureActiveCase,
  closeCase,
  normalizeRiskLevel,
  normalizeDisposition,
  visitTypeByAppointment,
  findNextAppointment,
}
