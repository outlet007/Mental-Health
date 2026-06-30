const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

const contentPath = path.join(__dirname, '..', 'data', 'content.json')

function renderIndex(counselors) {
  const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'index.ejs'),
      { content, counselors, query: {} },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('survey rating helper overlays counselor public ratings from survey data', () => {
  const { attachSurveyRatingsToCounselors } = require('../src/utils/counselor-survey-ratings')
  const counselors = [
    { id: 'c001', name: 'Counselor One', rating: 1.2, reviewCount: 7, isApproved: true },
    { id: 'c002', name: 'Counselor Two', rating: 4.1, reviewCount: 3, isApproved: true },
  ]
  const surveys = [
    { counselorId: 'c001', rating: 5 },
    { counselorId: 'c001', rating: 4 },
    { counselorId: 'c002', rating: 2 },
    { counselorId: 'missing', rating: 5 },
  ]

  const result = attachSurveyRatingsToCounselors(counselors, surveys)

  assert.equal(result.counselors[0].rating, 4.5)
  assert.equal(result.counselors[0].reviewCount, 2)
  assert.equal(result.counselors[0].ratingSource, 'surveys')
  assert.equal(result.counselors[1].rating, 2)
  assert.equal(result.counselors[1].reviewCount, 1)
  assert.equal(result.averageRating, '3.7')
})

test('public index renders live counselor ratings and total average from surveys', async () => {
  const html = await renderIndex([
    {
      id: 'c-live',
      name: 'Live Rating Counselor',
      title: 'Counselor',
      bio: 'Live score bio',
      specialties: ['Stress'],
      languages: [],
      avatar: 'LR',
      isApproved: true,
      rating: 4.8,
      reviewCount: 2,
      ratingSource: 'surveys',
    },
  ])

  assert.match(html, /data-counselor-rating="c-live"/)
  assert.match(html, /4\.8/)
  assert.match(html, /2 รีวิว/)
})
