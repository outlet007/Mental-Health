const crypto = require('crypto')

const CASE_STATUS = Object.freeze({ ACTIVE: 'active', CLOSED: 'closed' })
const RISK_LEVELS = Object.freeze(['none', 'low', 'moderate', 'high', 'critical'])
const CASE_DISPOSITIONS = Object.freeze(['follow_up', 'closed'])

function createCase(cases, { clientId, openedAt, concern = '' }) {
  const createdAt = new Date().toISOString()
  const record = {
    id: `case-${crypto.randomUUID()}`,
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
  createCase,
  findActiveCase,
  ensureActiveCase,
  closeCase,
  normalizeRiskLevel,
  normalizeDisposition,
  visitTypeByAppointment,
  findNextAppointment,
}