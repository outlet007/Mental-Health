const path = require('path')
const { readJSON, writeJSON } = require('./json-store')
const { ensureCaseAndAppointmentNumbers } = require('./case-management')

function migrateCaseNumbering(dataDir, { beforeWrite } = {}) {
  const casesFile = path.join(dataDir, 'cases.json')
  const appointmentsFile = path.join(dataDir, 'appointments.json')
  const cases = readJSON(casesFile, [])
  const appointments = readJSON(appointmentsFile, [])
  const result = ensureCaseAndAppointmentNumbers(cases, appointments)

  if (!result.changed) {
    return { ...result, caseCount: cases.length, appointmentCount: appointments.length }
  }

  if (beforeWrite) beforeWrite()
  if (result.casesChanged) writeJSON(casesFile, cases)
  if (result.appointmentsChanged) writeJSON(appointmentsFile, appointments)

  return { ...result, caseCount: cases.length, appointmentCount: appointments.length }
}

module.exports = { migrateCaseNumbering }
