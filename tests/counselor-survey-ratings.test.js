const assert = require('node:assert/strict')
const test = require('node:test')

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
