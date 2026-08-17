const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

const { validateContact } = require('../src/routes/contact')
const {
  getAllAudienceFields,
  getAudienceFields,
  readAudienceFields,
} = require('../src/utils/registration-audience-fields')

function renderIndex(content) {
  return ejs.renderFile(
    path.join(__dirname, '..', 'views', 'index.ejs'),
    { content, counselors: [], query: {} }
  )
}

const baseContent = {
  hero: { badge: 'b', heading1: 'h1', heading2: 'h2', subtext: 's', ctaMain: 'm', ctaSub: 's' },
  counselors: { heading: 'c', subtext: 's' },
  book: { heading: 'b', subtext: 's', formHeading: 'f' },
  faqs: [{ q: 'q', a: 'a' }],
  contact: { hours: 'hours' },
  backgrounds: {},
  en: {},
}

test('audience field settings default to visible and save student/staff independently', () => {
  const defaults = getAllAudienceFields({})
  assert.equal(defaults.student.studentId, true)
  assert.equal(defaults.staff.sessionType, true)

  const saved = readAudienceFields({
    audienceField_student_studentId: 'on',
    audienceField_student_email: 'on',
    audienceField_staff_phone: 'on',
  })
  assert.equal(saved.student.studentId, true)
  assert.equal(saved.student.phone, false)
  assert.equal(saved.staff.studentId, false)
  assert.equal(saved.staff.phone, true)
})

test('public registration form includes audience identity and client-side field visibility controls', async () => {
  const content = {
    ...baseContent,
    book: {
      ...baseContent.book,
      audienceFields: {
        student: { studentId: true, faculty: true, phone: true, email: true, concern: true, sessionType: true },
        staff: { studentId: false, faculty: false, phone: true, email: true, concern: false, sessionType: true },
      },
    },
  }
  const html = await renderIndex(content)

  assert.match(html, /name="audience" id="registrationAudience" value="student"/)
  assert.match(html, /data-registration-field="studentId"/)
  assert.match(html, /data-registration-field="faculty"/)
  assert.match(html, /data-registration-field="sessionType"/)
  assert.match(html, /const AUDIENCE_FIELD_VISIBILITY = [^;]+/)
  assert.match(html, /function applyAudienceFields\(\)/)
  assert.match(html, /control\.disabled = !visible/)
  assert.match(html, /control\.required = visible/)
})

test('server validation does not require fields hidden for the selected audience', () => {
  const staffFields = getAudienceFields({
    book: { audienceFields: { staff: {
      studentId: false,
      faculty: false,
      phone: false,
      email: false,
      concern: false,
      sessionType: false,
    } } },
  }, 'staff')

  const contact = validateContact(
    { audience: 'staff', name: 'Staff User', pdpa_consent: 'on' },
    new Set(['online']),
    [],
    [],
    staffFields
  )

  assert.deepEqual(contact, {
    audience: 'staff',
    name: 'Staff User',
    studentId: '',
    facultyIndex: '',
    faculty: '',
    facultyEn: '',
    phone: '',
    email: '',
    concern: '',
    sessionType: 'online',
  })
})

test('admin registration editor exposes separate student and staff field controls', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'admin', 'registration-form.ejs'),
    'utf8'
  )
  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'admin', 'registration-form.js'),
    'utf8'
  )

  assert.match(source, /data-audience-config="<%= audienceKey %>"/)
  assert.match(source, /audienceField_<%= audienceKey %>_<%= fieldKey %>/)
  assert.match(source, /แสดงเสมอ:<\/strong> ชื่อ-นามสกุล และการยินยอม PDPA/)
  assert.match(routeSource, /router\.post\('\/fields'/)
  assert.match(routeSource, /data\.book\.audienceFields = readAudienceFields/)
})
