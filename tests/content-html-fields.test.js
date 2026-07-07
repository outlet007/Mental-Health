const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

// Every field an admin can mark up with basic HTML (e.g. <br>, <strong>) from
// the content/registration-form editors. Each value below deliberately
// contains a tag so we can confirm it survives unescaped into the page.
function renderIndex(overrides = {}) {
  const content = {
    hero: {
      badge: 'badge',
      heading1: 'Heading <strong>one</strong>',
      heading2: 'Heading <em>two</em>',
      subtext: 'Subtext line one<br>line two',
      ctaMain: 'main',
      ctaSub: 'sub',
    },
    counselors: {
      heading: 'Counselors <strong>heading</strong>',
      subtext: 'Counselors subtext<br>second line',
    },
    book: {
      heading: 'Book <strong>heading</strong>',
      subtext: 'Book subtext<br>second line',
      formHeading: 'Form <em>heading</em>',
      formTexts: {
        successHeading: 'Success <strong>heading</strong>',
        pdpaHeading: 'PDPA <strong>heading</strong>',
        pdpaText: 'PDPA text<br>second line',
      },
    },
    faqs: [{ q: 'Question <strong>one</strong>?', a: 'Answer <br>one' }],
    contact: { description: 'Footer desc<br>second line', hours: 'hours' },
    backgrounds: {},
    en: {},
    ...overrides,
  }

  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'index.ejs'),
      { content, counselors: [], query: {} },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('hero heading/subtext render HTML tags unescaped and use the HTML i18n hook', async () => {
  const html = await renderIndex()
  assert.match(html, /data-i18n-html="hero-h1">Heading <strong>one<\/strong>/)
  assert.match(html, /data-i18n-html="hero-h2">Heading <em>two<\/em>/)
  assert.match(html, /data-i18n-html="hero-subtext"[^>]*>\s*Subtext line one<br>line two/)
  assert.doesNotMatch(html, /&lt;strong&gt;one&lt;\/strong&gt;/)
})

test('counselors and book section heading/subtext render HTML unescaped', async () => {
  const html = await renderIndex()
  assert.match(html, /data-i18n-html="counselors-heading"[^>]*>Counselors <strong>heading<\/strong>/)
  assert.match(html, /data-i18n-html="counselors-subtext"[^>]*>Counselors subtext<br>second line/)
  assert.match(html, /data-i18n-html="book-heading"[^>]*>Book <strong>heading<\/strong>/)
  assert.match(html, /data-i18n-html="book-subtext"[^>]*>Book subtext<br>second line/)
  assert.match(html, /data-i18n-html="form-heading"[^>]*>Form <em>heading<\/em>/)
})

function renderBookForm(query) {
  const content = {
    hero: { badge: 'b', heading1: 'h', heading2: 'h', subtext: 's', ctaMain: 'm', ctaSub: 's' },
    counselors: { heading: 'c', subtext: 's' },
    book: {
      heading: 'b', subtext: 's', formHeading: 'f',
      formTexts: {
        successHeading: 'Success <strong>heading</strong>',
        pdpaHeading: 'PDPA <strong>heading</strong>',
        pdpaText: 'PDPA text<br>second line',
      },
    },
    faqs: [{ q: 'q1', a: 'a1' }],
    contact: { hours: 'hours' },
    backgrounds: {},
    en: {},
  }
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'index.ejs'),
      { content, counselors: [], query },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('registration success heading renders HTML unescaped (post-submission view)', async () => {
  const html = await renderBookForm({ sent: '1' })
  assert.match(html, /data-i18n-html="book-success-heading">Success <strong>heading<\/strong>/)
})

test('PDPA heading and text render HTML unescaped (pre-submission form view)', async () => {
  const html = await renderBookForm({})
  assert.match(html, /data-i18n-html="pdpa-heading">PDPA <strong>heading<\/strong>/)
  assert.match(html, /data-i18n-html="pdpa-text">PDPA text<br>second line/)
})

test('footer description renders HTML unescaped', async () => {
  const html = await renderIndex()
  assert.match(html, /data-i18n-html="footer-desc"[^>]*>Footer desc<br>second line/)
})

test('FAQ question renders HTML unescaped and the client-side toggle uses innerHTML for both question and answer', async () => {
  const html = await renderIndex()
  assert.match(html, /<span data-faq-q[^>]*>Question <strong>one<\/strong>\?<\/span>/)
  assert.match(html, /<p class="mt-3 text-sm text-slate-500 leading-relaxed" data-faq-a[^>]*>Answer <br>one<\/p>/)
  assert.match(html, /qEl\.innerHTML = faqItems\[idx\]\.q/)
  assert.match(html, /aEl\.innerHTML = faqItems\[idx\]\.a/)
})

test('features section heading/subtext/bullet items render HTML unescaped', async () => {
  const html = await renderIndex({
    features: {
      heading: 'Features <strong>heading</strong>',
      subtext: 'Features subtext<br>second line',
      items: ['Bullet <strong>one</strong>'],
    },
  })
  assert.match(html, /data-i18n-html="features-heading"[^>]*>Features <strong>heading<\/strong>/)
  assert.match(html, /data-i18n-html="features-subtext"[^>]*>Features subtext<br>second line/)
  assert.match(html, /data-i18n-html="feature-0"[^>]*>Bullet <strong>one<\/strong>/)
})

test('footer copyright renders HTML unescaped', async () => {
  const html = await renderIndex({ contact: { copyright: 'Copyright <strong>text</strong>' } })
  assert.match(html, /data-i18n-html="footer-copyright"[^>]*>Copyright <strong>text<\/strong>/)
})

test('form error message and PDPA checkbox label render HTML unescaped', async () => {
  const content = {
    hero: { badge: 'b', heading1: 'h', heading2: 'h', subtext: 's', ctaMain: 'm', ctaSub: 's' },
    counselors: { heading: 'c', subtext: 's' },
    book: {
      heading: 'b', subtext: 's', formHeading: 'f',
      formTexts: {
        errorText: 'Error <strong>text</strong>',
        pdpaCheckbox: 'Checkbox <strong>label</strong>',
      },
    },
    faqs: [{ q: 'q1', a: 'a1' }],
    contact: { hours: 'hours' },
    backgrounds: {},
    en: {},
  }
  const html = await new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'index.ejs'),
      { content, counselors: [], query: { error: 'missing' } },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
  assert.match(html, /data-i18n-html="form-error">Error <strong>text<\/strong>/)
  assert.match(html, /data-i18n-html="pdpa-checkbox">Checkbox <strong>label<\/strong>/)
})

test('fields intentionally left as plain text still escape HTML (short labels/buttons)', async () => {
  const content = {
    hero: { badge: '<strong>badge</strong>', heading1: 'h1', heading2: 'h2', subtext: 'sub', ctaMain: '<b>main</b>', ctaSub: 'sub' },
    counselors: { heading: 'c', subtext: 's' },
    book: { heading: 'b', subtext: 's', formHeading: 'f' },
    faqs: [{ q: 'q1', a: 'a1' }],
    contact: { hours: 'hours' },
    backgrounds: {},
    en: {},
  }
  const html = await new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'index.ejs'),
      { content, counselors: [], query: {} },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
  assert.doesNotMatch(html, /data-i18n="hero-badge"><strong>badge<\/strong>/)
  assert.match(html, /data-i18n="hero-badge">&lt;strong&gt;badge&lt;\/strong&gt;/)
})
