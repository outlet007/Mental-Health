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

test('the cookie consent banner renders with the required Thai notice text and an "ยอมรับ" accept button', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /id="cookie-consent"/)
  assert.match(html, /เราใช้ cookies บนเว็บไซต์นี้เพื่อการบริหารเว็บไซต์ และเพิ่มประสิทธิภาพการใช้งานของท่าน สามารถตรวจสอบหรือดูนโยบายของ cookies ได้/)
  assert.match(html, /id="cookie-consent-accept"[^>]*>ยอมรับ</)
})

test('the "ที่นี่" link inside the cookie banner points at the exact BU cookie policy URL', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /<a href="https:\/\/www\.bu\.ac\.th\/th\/cookies" target="_blank" rel="noopener"[^>]*>ที่นี่<\/a>/)
})

test('the cookie banner is hidden by default (client-side script decides visibility from localStorage)', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /id="cookie-consent" class="[^"]*\bhidden\b[^"]*"/)
})

test('the accept button persists consent to localStorage and hides the banner', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /localStorage\.setItem\(KEY, '1'\)/)
  assert.match(html, /localStorage\.getItem\(KEY\)/)
})

test('the English translation of the banner links the English BU cookie policy URL with an "Accept" button label', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /'cookie-consent-text':.*https:\/\/www\.bu\.ac\.th\/en\/cookies.*>here<\/a>/)
  assert.match(html, /'cookie-consent-accept': 'Accept'/)
})
