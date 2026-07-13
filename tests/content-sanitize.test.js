const assert = require('node:assert/strict')
const test = require('node:test')
const { sanitizeContentTree, sanitizeString } = require('../src/utils/sanitize-content')

test('strips <script> tags entirely, including their contents', () => {
  assert.equal(sanitizeString('hello <script>alert(1)</script> world'), 'hello  world')
})

test('strips event handler attributes and javascript: URLs even on tags that would otherwise be allowed', () => {
  assert.equal(sanitizeString('<strong onmouseover="alert(1)">hover me</strong>'), '<strong>hover me</strong>')
  assert.equal(sanitizeString('<img src=x onerror="alert(1)">'), '')
})

test('strips disallowed tags (a, span, iframe, svg) but keeps their text content', () => {
  assert.equal(sanitizeString('<a href="javascript:alert(1)">click</a>'), 'click')
  assert.equal(sanitizeString('<span style="color:red">red</span>'), 'red')
  assert.equal(sanitizeString('<iframe src="https://evil.test"></iframe>after'), 'after')
})

test('keeps the small set of formatting tags used by the CMS (strong/em/br/b/i/u)', () => {
  assert.equal(sanitizeString('Heading <strong>one</strong>'), 'Heading <strong>one</strong>')
  assert.equal(sanitizeString('Subtext line one<br>line two'), 'Subtext line one<br>line two')
  assert.equal(sanitizeString('<em>emphasis</em> and <b>bold</b> and <i>italic</i> and <u>underline</u>'),
    '<em>emphasis</em> and <b>bold</b> and <i>italic</i> and <u>underline</u>')
})

test('leaves plain text, hex colors, image paths, and URLs completely unchanged', () => {
  assert.equal(sanitizeString('#ffffff'), '#ffffff')
  assert.equal(sanitizeString('/uploads/content/1234-abcd.png'), '/uploads/content/1234-abcd.png')
  assert.equal(sanitizeString('https://page.line.me/bucare?openQrModal=true'), 'https://page.line.me/bucare?openQrModal=true')
  assert.equal(sanitizeString('translateY'), 'translateY')
})

test('sanitizeContentTree recurses through nested objects and arrays, leaving non-strings untouched', () => {
  const input = {
    hero: { heading1: 'Hi <script>alert(1)</script>there', opacity: 0.5, visible: true },
    faqs: [{ q: '<strong>Q</strong><img src=x onerror=alert(2)>', a: 'plain' }],
    backgrounds: { hero: { color: '#abcdef', motionStyle: 'scale' } },
  }
  const result = sanitizeContentTree(input)
  assert.equal(result.hero.heading1, 'Hi there')
  assert.equal(result.hero.opacity, 0.5)
  assert.equal(result.hero.visible, true)
  assert.equal(result.faqs[0].q, '<strong>Q</strong>')
  assert.equal(result.faqs[0].a, 'plain')
  assert.equal(result.backgrounds.hero.color, '#abcdef')
  assert.equal(result.backgrounds.hero.motionStyle, 'scale')
})
