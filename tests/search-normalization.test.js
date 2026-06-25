const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const { normalizeSearchText, matchesSearch } = require('../src/utils/search')

test('normalizeSearchText removes spacing and punctuation noise for partial search', () => {
  assert.equal(normalizeSearchText('  Sup aporn  '), 'supaporn')
  assert.equal(normalizeSearchText('081-234 5678'), '0812345678')
  assert.equal(normalizeSearchText('\u0e2a\u0e38 \u0e20\u0e32'), '\u0e2a\u0e38\u0e20\u0e32')
})

test('matchesSearch finds partial text even when user types extra spaces or separators', () => {
  assert.equal(matchesSearch(['Dr. Supaporn', 'supaporn@mindcare.th', '081-234-5678'], ' sup aporn '), true)
  assert.equal(matchesSearch(['Dr. Supaporn', 'supaporn@mindcare.th', '081-234-5678'], '081 234'), true)
  assert.equal(matchesSearch(['\u0e2a\u0e38\u0e20\u0e32\u0e1e\u0e23'], '\u0e2a\u0e38 \u0e20\u0e32'), true)
  assert.equal(matchesSearch(['Dr. Supaporn'], 'nonmatching'), false)
})

test('admin routes with text search use normalized matching helper', () => {
  const routeFiles = ['admins.js', 'appointments.js', 'clients.js', 'contacts.js', 'counselors.js']
  for (const file of routeFiles) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', file), 'utf8')
    assert.match(source, /matchesSearch/, file)
  }
})
