const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')
const { buildFacultyOptions, resolveFaculty } = require('../src/utils/faculty-options')

const content = {
  branding: {},
  backgrounds: {},
  hero: { badge: 'b', heading1: 'h1', heading2: 'h2', subtext: 's', ctaMain: 'm', ctaSub: 's' },
  counselors: { heading: 'c', subtext: 's' },
  features: { heading: 'f', subtext: 's', items: [] },
  book: { heading: 'b', subtext: 's', formHeading: 'f', facultyOptions: ['คณะหนึ่ง', 'คณะสอง'] },
  faqs: [],
  contact: {},
  en: { book: { facultyOptions: ['Faculty One', 'Faculty Two'] } },
}

test('faculty options pair Thai and English values by their backend order', () => {
  const options = buildFacultyOptions(content)
  assert.deepEqual(options.slice(0, 2), [
    { index: '0', th: 'คณะหนึ่ง', en: 'Faculty One' },
    { index: '1', th: 'คณะสอง', en: 'Faculty Two' },
  ])
  assert.deepEqual(resolveFaculty('1', options), {
    facultyIndex: '1', faculty: 'คณะสอง', facultyEn: 'Faculty Two',
  })
})

test('public form renders one required full-width faculty select after student id with bilingual options', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'index.ejs'), {
    content,
    counselors: [],
    query: {},
    facultyOptions: buildFacultyOptions(content),
  })
  const studentPosition = html.indexOf('name="studentId"')
  const facultyPosition = html.indexOf('name="facultyIndex"')
  const phonePosition = html.indexOf('name="phone"')
  assert.ok(studentPosition >= 0 && studentPosition < facultyPosition && facultyPosition < phonePosition)
  assert.match(html, /<select name="facultyIndex"[^>]*required>/)
  assert.match(html, /'faculty-0':\s*"?คณะหนึ่ง"?/)
  assert.match(html, /'faculty-0':\s*"?Faculty One"?/)
})

test('backend registration editor provides Thai and English faculty list controls', () => {
  const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'registration-form.ejs'), 'utf8')
  assert.match(view, /name="bookFacultyOption"/)
  assert.match(view, /name="bookFacultyOptionEn"/)
  assert.match(view, /registration-faculty-list-th/)
  assert.match(view, /registration-faculty-list-en/)
})

test('backend contacts page displays and edits the saved faculty', () => {
  const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'contacts.ejs'), 'utf8')
  assert.match(view, /id="er_facultyIndex"/)
  assert.match(view, /c\.faculty/)
})
