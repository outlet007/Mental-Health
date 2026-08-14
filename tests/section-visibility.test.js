const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')
const contentRouter = require('../src/routes/admin/content')

const SECTION_KEYS = ['hero', 'counselors', 'features', 'book', 'faq', 'footer']

function minimalContent(sectionVisibility, sectionOrder) {
  return {
    branding: {},
    backgrounds: {},
    sectionVisibility,
    sectionOrder,
    hero: {
      badge: 'Badge',
      heading1: 'Heading',
      heading2: 'Heading two',
      subtext: 'Subtext',
      ctaMain: 'Book',
      ctaSub: 'Counselors',
      visualImage: '',
    },
    counselors: { heading: 'Counselors', subtext: 'Counselor description' },
    features: { heading: 'Features', subtext: 'Feature description', items: [] },
    book: {
      heading: 'Registration',
      subtext: 'Registration description',
      formHeading: 'Registration form',
      concernOptions: [],
      sessionTypes: {},
      formTexts: {},
    },
    faqs: [],
    contact: {},
    en: {
      hero: {},
      counselors: {},
      features: { items: [] },
      book: { concernOptions: [], formTexts: {} },
      faqs: [],
      contact: {},
    },
  }
}

function renderIndex(content) {
  return ejs.renderFile(
    path.join(__dirname, '..', 'views', 'index.ejs'),
    { content, counselors: [], query: {} }
  )
}

test('content admin exposes a visibility control for every public section', () => {
  const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'content.ejs'), 'utf8')

  assert.match(view, /action="\/admin\/content\/visibility"/)
  assert.match(view, /name="visibility_<%= section.key %>"/)
  assert.match(view, /name="sectionOrder"/)
  assert.match(view, /function moveVisibilitySection/)
  SECTION_KEYS.forEach(key => assert.match(view, new RegExp("\\{ key:'" + key + "'")))
})

test('section order is normalized and missing or invalid keys are appended safely', () => {
  assert.deepEqual(contentRouter.normalizeSectionOrder('book,hero,book,invalid'), [
    'book', 'hero', 'counselors', 'features', 'faq', 'footer',
  ])
})

test('visibility values default to false unless their checkbox was submitted', () => {
  assert.deepEqual(contentRouter.buildSectionVisibility({
    visibility_hero: 'on',
    visibility_book: 'on',
  }), {
    hero: true,
    counselors: false,
    features: false,
    book: true,
    faq: false,
    footer: false,
  })
})

test('public page omits disabled sections and their navigation links', async () => {
  const html = await renderIndex(minimalContent({
    hero: false,
    counselors: false,
    features: false,
    book: true,
    faq: false,
    footer: false,
  }))

  assert.doesNotMatch(html, /<section id="home"/)
  assert.doesNotMatch(html, /<section id="counselors"/)
  assert.doesNotMatch(html, /<section id="features"/)
  assert.match(html, /<section id="book"/)
  assert.doesNotMatch(html, /<section id="faq"/)
  assert.doesNotMatch(html, /<footer class=/)
  assert.doesNotMatch(html, /href="#counselors"/)
  assert.match(html, /href="#book"/)
})

test('sections remain visible by default when no visibility setting exists', async () => {
  const html = await renderIndex(minimalContent(undefined))

  assert.match(html, /<section id="home"/)
  assert.match(html, /<section id="counselors"/)
  assert.match(html, /<section id="features"/)
  assert.match(html, /<section id="book"/)
  assert.match(html, /<section id="faq"/)
  assert.match(html, /<footer class=/)
})

test('public sections receive the saved visual order', async () => {
  const html = await renderIndex(minimalContent(undefined, [
    'book', 'hero', 'features', 'counselors', 'faq', 'footer',
  ]))

  assert.match(html, /id="book"[^>]+order:0;/)
  assert.match(html, /id="home"[^>]+order:1;/)
  assert.match(html, /id="features"[^>]+order:2;/)
  assert.match(html, /id="counselors"[^>]+order:3;/)
  assert.match(html, /<footer[^>]+order:5;/)
})
