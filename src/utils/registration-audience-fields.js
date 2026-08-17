const AUDIENCES = ['student', 'staff']
const CONFIGURABLE_FIELDS = ['studentId', 'faculty', 'phone', 'email', 'concern', 'sessionType']

function normalizeAudience(value) {
  return value === 'staff' ? 'staff' : 'student'
}

function defaultFields() {
  return Object.fromEntries(CONFIGURABLE_FIELDS.map(field => [field, true]))
}

function getAudienceFields(content, audience) {
  const key = normalizeAudience(audience)
  const configured = content?.book?.audienceFields?.[key] || {}
  return { ...defaultFields(), ...configured }
}

function getAllAudienceFields(content) {
  return Object.fromEntries(AUDIENCES.map(audience => [audience, getAudienceFields(content, audience)]))
}

function readAudienceFields(body) {
  return Object.fromEntries(AUDIENCES.map(audience => [
    audience,
    Object.fromEntries(CONFIGURABLE_FIELDS.map(field => [
      field,
      body[`audienceField_${audience}_${field}`] === 'on',
    ])),
  ]))
}

module.exports = {
  AUDIENCES,
  CONFIGURABLE_FIELDS,
  getAllAudienceFields,
  getAudienceFields,
  normalizeAudience,
  readAudienceFields,
}
