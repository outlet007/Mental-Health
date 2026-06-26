const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const ejs = require('ejs')

const contentPath = path.join(__dirname, '..', 'data', 'content.json')

function requestRegistrationForm(pathname = '/admin/registration-form') {
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '..', 'views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/registration-form', require('../src/routes/admin/registration-form'))

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

function postRegistrationForm(pathname, fields) {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use('/admin/registration-form', require('../src/routes/admin/registration-form'))

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

test('registration form admin page is a system menu item', async () => {
  const sidebar = await ejs.renderFile(
    path.join(__dirname, '..', 'views', 'partials', 'admin-sidebar.ejs'),
    { page: 'registration-form', session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' } }
  )

  const contentIndex = sidebar.indexOf('href="/admin/content"')
  const formIndex = sidebar.indexOf('href="/admin/registration-form"')
  const reportsIndex = sidebar.indexOf('href="/admin/reports"')

  assert.ok(contentIndex >= 0)
  assert.ok(formIndex > contentIndex)
  assert.ok(formIndex < reportsIndex)
  assert.match(sidebar, /จัดการฟอร์มลงทะเบียน/)
})

test('registration form admin page renders editable TH and EN form controls', async () => {
  const { res, body } = await requestRegistrationForm('/admin/registration-form?saved=en')

  assert.equal(res.statusCode, 200)
  assert.match(body, /จัดการฟอร์มลงทะเบียนเพื่อขอรับบริการให้คำปรึกษา/)
  assert.match(body, /id="registration-btn-th"/)
  assert.match(body, /id="registration-btn-en"/)
  assert.match(body, /name="bookHeading"/)
  assert.match(body, /name="bookFormHeading"/)
  assert.match(body, /name="bookConcernOption"/)
  assert.match(body, /name="bookConcernOptionEn"/)
  assert.match(body, /name="formText_nameLabel"/)
  assert.match(body, /name="formText_pdpaText"/)
  assert.match(body, /name="formText_submitLabel"/)
  assert.match(body, /id="registration-en" style="display:;"/)
})

test('registration concern options render add and remove controls', async () => {
  const { res, body } = await requestRegistrationForm('/admin/registration-form')

  assert.equal(res.statusCode, 200)
  assert.match(body, /id="registration-concern-list-th"/)
  assert.match(body, /id="registration-concern-list-en"/)
  assert.match(body, /data-option-row="bookConcernOption"/)
  assert.match(body, /data-option-row="bookConcernOptionEn"/)
  assert.ok(body.includes(`onclick="addConcernOption('registration-concern-list-th','bookConcernOption',`))
  assert.ok(body.includes(`onclick="addConcernOption('registration-concern-list-en','bookConcernOptionEn','Option')"`))
  assert.ok(body.includes('onclick="removeConcernOption(this)"'))
})

test('registration concern options support drag and drop ordering', async () => {
  const { res, body } = await requestRegistrationForm('/admin/registration-form')

  assert.equal(res.statusCode, 200)
  assert.match(body, /draggable="true"/)
  assert.match(body, /data-drag-handle="true"/)
  assert.match(body, /data-drag-row="bookConcernOption"/)
  assert.match(body, /data-drag-row="bookConcernOptionEn"/)
  assert.match(body, /function handleConcernDragStart/)
  assert.match(body, /function handleConcernDragOver/)
  assert.match(body, /function handleConcernDrop/)
  assert.match(body, /function moveConcernRow/)
})

test('registration form page saves all visible Thai form settings', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  try {
    const res = await postRegistrationForm('/admin/registration-form', {
      bookHeading: 'Custom registration heading',
      bookSubtext: 'Custom registration subtext',
      bookFormHeading: 'Custom form heading',
      bookConcernOption: ['Stress option', 'Sleep option'],
      formText_successHeading: 'Custom success heading',
      formText_successText: 'Custom success text',
      formText_errorText: 'Custom error text',
      formText_nameLabel: 'Custom name label',
      formText_namePlaceholder: 'Custom name placeholder',
      formText_studentIdLabel: 'Custom student id label',
      formText_studentIdPlaceholder: 'Custom student id placeholder',
      formText_phoneLabel: 'Custom phone label',
      formText_emailLabel: 'Custom email label',
      formText_concernLabel: 'Custom concern label',
      formText_typeLabel: 'Custom type label',
      formText_onlineLabel: 'Custom online label',
      formText_onsiteLabel: 'Custom onsite label',
      formText_pdpaHeading: 'Custom PDPA heading',
      formText_pdpaText: 'Custom PDPA text',
      formText_pdpaCheckbox: 'Custom PDPA checkbox',
      formText_submitLabel: 'Custom submit label',
    })

    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.location, '/admin/registration-form?saved=th')
    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    assert.equal(saved.book.heading, 'Custom registration heading')
    assert.deepEqual(saved.book.concernOptions, ['Stress option', 'Sleep option'])
    assert.equal(saved.book.formTexts.nameLabel, 'Custom name label')
    assert.equal(saved.book.formTexts.pdpaText, 'Custom PDPA text')
    assert.equal(saved.book.formTexts.submitLabel, 'Custom submit label')
  } finally {
    fs.writeFileSync(contentPath, before)
  }
})

test('registration form page saves all visible English form settings', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  try {
    const res = await postRegistrationForm('/admin/registration-form/en', {
      bookHeading: 'English registration heading',
      bookSubtext: 'English registration subtext',
      bookFormHeading: 'English form heading',
      bookConcernOptionEn: ['English stress', 'English sleep'],
      formText_nameLabel: 'English name label',
      formText_pdpaText: 'English PDPA text',
      formText_submitLabel: 'English submit label',
    })

    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.location, '/admin/registration-form?saved=en')
    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    assert.equal(saved.en.book.heading, 'English registration heading')
    assert.deepEqual(saved.en.book.concernOptions, ['English stress', 'English sleep'])
    assert.equal(saved.en.book.formTexts.nameLabel, 'English name label')
    assert.equal(saved.en.book.formTexts.pdpaText, 'English PDPA text')
    assert.equal(saved.en.book.formTexts.submitLabel, 'English submit label')
  } finally {
    fs.writeFileSync(contentPath, before)
  }
})

test('home page renders registration form text from content data', async () => {
  const base = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
  base.book = {
    ...base.book,
    formTexts: {
      ...(base.book.formTexts || {}),
      nameLabel: 'Rendered name label',
      pdpaText: 'Rendered PDPA text',
      submitLabel: 'Rendered submit label',
    },
  }
  base.en = base.en || {}
  base.en.book = {
    ...(base.en.book || {}),
    formTexts: {
      ...((base.en.book && base.en.book.formTexts) || {}),
      nameLabel: 'Rendered English name label',
      pdpaText: 'Rendered English PDPA text',
      submitLabel: 'Rendered English submit label',
    },
  }

  const html = await renderIndex(base)

  assert.match(html, /Rendered name label/)
  assert.match(html, /Rendered PDPA text/)
  assert.match(html, /Rendered submit label/)
  assert.match(html, /'form-label-name': "Rendered English name label"/)
  assert.match(html, /'pdpa-text': "Rendered English PDPA text"/)
  assert.match(html, /'form-submit': "Rendered English submit label"/)
})

test('website content page no longer contains registration form management controls', async () => {
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '..', 'views'))
  app.use((req, res, next) => {
    req.session = { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/content', require('../src/routes/admin/content'))

  const { res, body } = await new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: '/admin/content', method: 'GET' }, res => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { body += chunk })
        res.on('end', () => server.close(() => resolve({ res, body })))
      })
      req.on('error', err => server.close(() => reject(err)))
      req.end()
    })
  })

  assert.equal(res.statusCode, 200)
  assert.equal(body.includes('action="/admin/content/book"'), false)
  assert.doesNotMatch(body, /name="bookConcernOption"/)
  assert.doesNotMatch(body, /Registration form heading/)
})
