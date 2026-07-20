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

const baseContent = {
  hero: { badge: 'b', heading1: 'h1', heading2: 'h2', subtext: 's', ctaMain: 'm', ctaSub: 's' },
  counselors: { heading: 'c', subtext: 's' },
  book: { heading: 'b', subtext: 's', formHeading: 'f' },
  faqs: [{ q: 'q1', a: 'a1' }],
  contact: { hours: 'hours' },
  backgrounds: {},
  en: {},
}

test('when only one session format is enabled, its radio is pre-checked so the user does not have to click it', async () => {
  const html = await renderIndex({
    ...baseContent,
    book: { ...baseContent.book, sessionTypes: { online: false, phone: false, onsite: true } },
  })
  const radioMatches = html.match(/<input type="radio" name="type"[^>]*>/g) || []
  assert.equal(radioMatches.length, 1, 'only the enabled format should render')
  assert.match(radioMatches[0], /value="onsite"/)
  assert.match(radioMatches[0], /\bchecked\b/)
})

test('when more than one session format is enabled, none are pre-checked — the user must choose', async () => {
  const html = await renderIndex({
    ...baseContent,
    book: { ...baseContent.book, sessionTypes: { online: true, phone: false, onsite: true } },
  })
  const radioMatches = html.match(/<input type="radio" name="type"[^>]*>/g) || []
  assert.equal(radioMatches.length, 2)
  radioMatches.forEach(tag => assert.doesNotMatch(tag, /\bchecked\b/))
})

test('with the default (all 3 formats enabled), none are pre-checked', async () => {
  const html = await renderIndex(baseContent)
  const radioMatches = html.match(/<input type="radio" name="type"[^>]*>/g) || []
  assert.equal(radioMatches.length, 3)
  radioMatches.forEach(tag => assert.doesNotMatch(tag, /\bchecked\b/))
})
