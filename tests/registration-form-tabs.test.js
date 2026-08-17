const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

function renderIndex(content) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'index.ejs'),
      { content, counselors: [], query: {} },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

function audienceTab(html, audience) {
  const match = html.match(new RegExp(`<button[^>]*data-audience-tab="${audience}"[\\s\\S]*?<\\/button>`))
  return match ? match[0] : ''
}

const baseContent = {
  hero: { badge: 'b', heading1: 'h1', heading2: 'h2', subtext: 's', ctaMain: 'm', ctaSub: 's' },
  counselors: { heading: 'c', subtext: 's' },
  book: { heading: 'b', subtext: 's', formHeading: 'f' },
  faqs: [{ q: 'q1', a: 'a1' }],
  contact: { hours: 'hours' },
  backgrounds: {},
  en: {},
}

test('the registration form shows a นักศึกษา / อาจารย์-บุคลากร tab switcher above the fields', async () => {
  const html = await renderIndex(baseContent)
  assert.match(audienceTab(html, 'student'), /นักศึกษา/)
  assert.match(audienceTab(html, 'staff'), /อาจารย์\/บุคลากร/)
})

test('the student tab uses a graduation-cap icon and the staff tab uses a briefcase icon', async () => {
  const html = await renderIndex(baseContent)
  assert.match(audienceTab(html, 'student'), /data-lucide="graduation-cap"/)
  assert.match(audienceTab(html, 'staff'), /data-lucide="briefcase"/)
})

test('the studentId field keeps the same name attribute regardless of tab, so stored data is unaffected', async () => {
  const html = await renderIndex(baseContent)
  const inputMatches = html.match(/<input[^>]*name="studentId"[^>]*>/g) || []
  assert.equal(inputMatches.length, 1, 'expected exactly one studentId input — the tabs must not duplicate the field')
  assert.match(inputMatches[0], /type="text"/)
})

test('the staff tab has its own hardcoded label/placeholder text (Thai + English) wired up client-side', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /AUDIENCE_STAFF_TEXT/)
  assert.match(html, /label:\s*'รหัสอาจารย์\/บุคลากร'/)
  assert.match(html, /label:\s*'Faculty\/Staff ID'/)
})

test('setAudience() swaps the visible studentId label/placeholder without touching the input name', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /function setAudience\(audience\)/)
  assert.match(html, /function applyAudienceLabel\(\)/)
  assert.match(html, /inputEl\.placeholder = staffText\.placeholder/)
})

test('the tab labels are translated for both Thai and English (form-tab-student/form-tab-staff)', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /'form-tab-student':\s*'นักศึกษา'/)
  assert.match(html, /'form-tab-staff':\s*'อาจารย์\/บุคลากร'/)
  assert.match(html, /'form-tab-student':\s*'Student'/)
  assert.match(html, /'form-tab-staff':\s*'Faculty\/Staff'/)
})

test('the email field placeholder differs per audience tab: your@bumail.net for students, your@bu.ac.th for staff', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /AUDIENCE_EMAIL_PLACEHOLDER\s*=\s*\{\s*student:\s*'your@bumail\.net',\s*staff:\s*'your@bu\.ac\.th'\s*\}/)
  assert.match(html, /emailInputEl\.placeholder = AUDIENCE_EMAIL_PLACEHOLDER\[currentAudience\]/)
  const emailInputMatches = html.match(/<input[^>]*name="email"[^>]*>/g) || []
  assert.equal(emailInputMatches.length, 1, 'expected exactly one email input')
})
