const assert = require('node:assert/strict')
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
