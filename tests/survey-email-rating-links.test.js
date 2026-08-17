const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const { surveyEmailHtml } = require('../src/utils/mailer')

test('survey email ratings are Gmail-compatible links to a preselected score', () => {
  const html = surveyEmailHtml({
    appointment: { id: 'app-1', date: '2026-08-17', time: '10:00' },
    client: { name: 'Client' },
    counselor: { name: 'Counselor' },
    surveyUrl: 'http://localhost:8024/survey/token-1',
  })

  for (let rating = 1; rating <= 5; rating += 1) {
    assert.match(html, new RegExp(`href="http://localhost:8024/survey/token-1\\?rating=${rating}"`))
    assert.match(html, new RegExp(`aria-label="Rate ${rating} out of 5"`))
  }
  assert.doesNotMatch(html, /onclick=/)
})

test('survey page uses the rating query value as the initially checked score', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'survey.js'), 'utf8')
  const viewSource = fs.readFileSync(path.join(__dirname, '..', 'views', 'survey.ejs'), 'utf8')

  assert.match(routeSource, /req\.query\.rating/)
  assert.match(routeSource, /requestedRating >= 1 && requestedRating <= 5/)
  assert.match(viewSource, /e\.val === selectedRating \? 'checked' : ''/)
})
