const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const ejs = require('ejs')

const contentPath = path.join(__dirname, '..', 'data', 'content.json')

function postForm(pathname, fields) {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use('/admin/content', require('../src/routes/admin/content'))

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const params = new URLSearchParams()
      Object.entries(fields).forEach(([key, value]) => {
        ;[].concat(value).forEach(item => params.append(key, item))
      })
      const body = params.toString()
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      }, res => {
        res.resume()
        res.on('end', () => server.close(() => resolve(res)))
      })
      req.on('error', err => server.close(() => reject(err)))
      req.end(body)
    })
  })
}

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

test('content section endpoints save only their own website section', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  try {
    const first = JSON.parse(before)
    const res = await postForm('/admin/content/features', {
      featuresHeading: 'Feature Heading From Admin',
      featuresSubtext: 'Feature intro from admin',
      featureText: ['Verified counselors', 'Private data'],
      textColor_features_heading: '#101010',
      textColor_features_subtext: '#202020',
    })

    assert.equal(res.statusCode, 302)
    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    assert.equal(saved.features.heading, 'Feature Heading From Admin')
    assert.equal(saved.features.subtext, 'Feature intro from admin')
    assert.deepEqual(saved.features.items, ['Verified counselors', 'Private data'])
    assert.deepEqual(saved.counselors, first.counselors)
    assert.deepEqual(saved.book, first.book)
    assert.deepEqual(saved.contact, first.contact)
    assert.equal(saved.backgrounds.features.textColors.heading, '#101010')
    assert.equal(saved.backgrounds.features.textColors.subtext, '#202020')
  } finally {
    fs.writeFileSync(contentPath, before)
  }
})

test('home page renders features copy from content data instead of hardcoded text', async () => {
  const base = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
  base.features = {
    heading: 'Why this section is editable',
    subtext: 'Feature subtext controlled by backend',
    items: ['Editable proof one', 'Editable proof two'],
  }
  base.en = base.en || {}
  base.en.features = {
    heading: 'Editable English heading',
    subtext: 'Editable English subtext',
    items: ['English proof one', 'English proof two'],
  }

  const html = await renderIndex(base)

  assert.match(html, /Why this section is editable/)
  assert.match(html, /Feature subtext controlled by backend/)
  assert.match(html, /Editable proof one/)
  assert.match(html, /Editable proof two/)
  assert.match(html, /'features-heading': "Why this section is editable"/)
  assert.match(html, /'feature-0': "Editable proof one"/)
  assert.match(html, /'features-heading': "Editable English heading"/)
  assert.match(html, /'feature-1': "English proof two"/)
})


test('home page renders concern dropdown options from content data', async () => {
  const base = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
  base.book = {
    ...base.book,
    concernOptions: ['Editable concern A', 'Editable concern B'],
  }
  base.en = base.en || {}
  base.en.book = {
    ...(base.en.book || {}),
    concernOptions: ['Editable English concern A', 'Editable English concern B'],
  }

  const html = await renderIndex(base)

  assert.match(html, /data-i18n-opt="concern-1">Editable concern A/)
  assert.match(html, /data-i18n-opt="concern-2">Editable concern B/)
  assert.match(html, /'concern-1': "Editable English concern A"/)
  assert.match(html, /'concern-2': "Editable English concern B"/)
  assert.doesNotMatch(html, /concern-3/) 
})


test('contact footer endpoints save all visible footer fields and preserve legacy fields', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  try {
    const first = JSON.parse(before)
    const res = await postForm('/admin/content/contact-info', {
      contactDescription: 'Footer description from admin',
      contactLineLabel: 'LINE @bucare-updated',
      contactLineUrl: 'https://page.line.me/bucare-updated',
      contactHours: 'จันทร์-ศุกร์ 09.00-16.00 น.',
    })

    assert.equal(res.statusCode, 302)
    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    assert.equal(saved.contact.description, 'Footer description from admin')
    assert.equal(saved.contact.lineLabel, 'LINE @bucare-updated')
    assert.equal(saved.contact.lineUrl, 'https://page.line.me/bucare-updated')
    assert.equal(saved.contact.hours, 'จันทร์-ศุกร์ 09.00-16.00 น.')
    assert.equal(saved.contact.email, first.contact.email)
    assert.equal(saved.contact.phone, first.contact.phone)
  } finally {
    fs.writeFileSync(contentPath, before)
  }
})

test('contact footer editor exposes every footer field without unused email and phone inputs', async () => {
  const { res, body } = await requestAdminContent('/admin/content')

  assert.equal(res.statusCode, 200)
  assert.match(body, /name="contactDescription"/)
  assert.match(body, /name="contactLineLabel"/)
  assert.match(body, /name="contactLineUrl"/)
  assert.match(body, /name="contactHours"/)
  assert.match(body, /LINE @bucare/)
  assert.doesNotMatch(body, /name="contactEmail"/)
  assert.doesNotMatch(body, /name="contactPhone"/)
})


test('home page renders footer copy from content data', async () => {
  const base = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
  base.contact = {
    ...base.contact,
    description: 'Editable footer description',
    lineLabel: 'LINE @editable',
    lineUrl: 'https://page.line.me/editable',
    hours: 'Editable footer hours',
  }
  base.en = base.en || {}
  base.en.contact = {
    ...(base.en.contact || {}),
    description: 'Editable English footer description',
    lineLabel: 'LINE @editable-en',
    lineUrl: 'https://page.line.me/editable-en',
    hours: 'Editable English footer hours',
  }

  const html = await renderIndex(base)

  assert.match(html, /Editable footer description/)
  assert.match(html, /LINE @editable/)
  assert.ok(html.includes('https://page.line.me/editable'))
  assert.match(html, /Editable footer hours/)
  assert.match(html, /'footer-desc': "Editable English footer description"/)
  assert.match(html, /'footer-line': "LINE @editable-en"/)
  assert.ok(html.includes("'footer-line-url': \"https://page.line.me/editable-en\""))
  assert.match(html, /'footer-hours': "Editable English footer hours"/)
})


function requestAdminContent(pathname = '/admin/content') {
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '..', 'views'))
  app.use((req, res, next) => {
    req.session = { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/content', require('../src/routes/admin/content'))

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: pathname, method: 'GET' }, res => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { body += chunk })
        res.on('end', () => server.close(() => resolve({ res, body })))
      })
      req.on('error', err => server.close(() => reject(err)))
      req.end()
    })
  })
}

test('admin content section cards use the same TH EN toggle pattern as hero', async () => {
  const { res, body } = await requestAdminContent('/admin/content?saved=features-en')

  assert.equal(res.statusCode, 200)
  ;['counselors', 'features', 'contact'].forEach(section => {
    assert.match(body, new RegExp('id="' + section + '-btn-th"[^>]+onclick="cardLang\\(\'' + section + '\',\'th\'\\)"'))
    assert.match(body, new RegExp('id="' + section + '-btn-en"[^>]+onclick="cardLang\\(\'' + section + '\',\'en\'\\)"'))
    assert.match(body, new RegExp('id="' + section + '-th"'))
    assert.match(body, new RegExp('id="' + section + '-en"'))
  })
  assert.match(body, /id="features-en" style="display:;"/)
  assert.match(body, /id="features-th" style="display:none;"/)
})
