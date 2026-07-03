const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

const emojiPattern = /\p{Extended_Pictographic}/u

function renderView(name, locals) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', name),
      locals,
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('public survey pages use theme icons instead of emoji symbols', async () => {
  const baseLocals = {
    error: null,
    appt: {
      surveyToken: 'token-1',
      date: '2026-06-22',
      time: '09:00',
      counselorName: 'Counselor',
    },
    counselor: { name: 'Counselor' },
  }

  const survey = await renderView('survey.ejs', baseLocals)
  const notFound = await renderView('survey.ejs', { ...baseLocals, error: 'not_found' })
  const notReady = await renderView('survey.ejs', { ...baseLocals, error: 'not_ready' })
  const alreadyDone = await renderView('survey.ejs', { ...baseLocals, error: 'already_done' })
  const thanks = await renderView('survey-thanks.ejs', { rating: 5 })

  for (const html of [survey, notFound, notReady, alreadyDone, thanks]) {
    assert.doesNotMatch(html, emojiPattern)
    assert.match(html, /data-lucide=/)
  }

  assert.match(survey, /rating-icon/)
  assert.match(survey, /data-lucide="smile-plus"/)
  assert.match(thanks, /data-lucide="circle-check-big"/)
})

test('admin survey page keeps rating filters and badges inside the MindCare theme', async () => {
  const html = await renderView('admin/surveys.ejs', {
    title: 'แบบประเมินความพึงพอใจ',
    page: 'surveys',
    session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' },
    isCounselorUser: false,
    total: 1,
    avgRating: '5.0',
    ratingCounts: [
      { rating: 5, count: 1 },
      { rating: 4, count: 0 },
      { rating: 3, count: 0 },
      { rating: 2, count: 0 },
      { rating: 1, count: 0 },
    ],
    surveys: [{
      submittedAt: '2026-06-23T10:00:00.000Z',
      appointmentDate: '2026-06-22',
      clientName: 'Client',
      counselorName: 'Counselor',
      rating: 5,
      comment: '',
    }],
    query: { rating: 'all' },
  })

  assert.doesNotMatch(html, emojiPattern)
  assert.match(html, /rating-filter-icon/)
  assert.match(html, /data-lucide="smile-plus"/)
  assert.match(html, /data-lucide="bar-chart-3"/)
})


test('admin counselors page uses lucide satisfaction icons instead of emoji', async () => {
  const html = await renderView('admin/counselors.ejs', {
    title: 'Counselors',
    page: 'counselors',
    session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' },
    query: {},
    counselors: [{
      id: 'c001',
      name: 'Counselor',
      title: 'Clinical Psychologist',
      username: 'counselor',
      email: 'counselor@example.com',
      phone: '',
      photo: '',
      avatar: 'C',
      specialties: ['Stress'],
      languages: ['Thai'],
      sessionDuration: 50,
      isApproved: true,
      status: 'active',
      role: 'counselor',
    }],
    allCounselors: [],
    surveyStats: { c001: { sum: 5, count: 1 } },
    clientCounts: { c001: 3 },
  })

  assert.doesNotMatch(html, emojiPattern)
  assert.match(html, /data-lucide="smile-plus"/)
  const source = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'counselors.ejs'), 'utf8')
  assert.doesNotMatch(source, /const _ems/)
  assert.match(source, /const _icons = \{5:'smile-plus',4:'smile',3:'meh',2:'frown',1:'circle-alert'\}/)
  assert.match(source, /const _color = \{5:'#159f91',4:'#9db64b',3:'#d8b545',2:'#d88a55',1:'#d85b6c'\}/)
  assert.match(source, /const _bg = \{5:'#eefbf8',4:'#f5fae9',3:'#fff8df',2:'#fff1e8',1:'#fff0f3'\}/)
})


test('admin reports satisfaction icons use the same score color palette', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'reports.ejs'), 'utf8')

  assert.match(source, /const RATING_COLOR = \{5:'#159f91',4:'#9db64b',3:'#d8b545',2:'#d88a55',1:'#d85b6c'\}/)
  assert.match(source, /const RATING_BG = \{5:'#eefbf8',4:'#f5fae9',3:'#fff8df',2:'#fff1e8',1:'#fff0f3'\}/)
})
