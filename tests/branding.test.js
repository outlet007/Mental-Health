const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const ejs = require('ejs')

const contentPath = path.join(__dirname, '..', 'data', 'content.json')

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

test('without branding configured, header and footer fall back to the default icon + MindCare text', async () => {
  const html = await renderIndex(baseContent)
  assert.match(html, /data-lucide="heart-handshake"/)
  assert.doesNotMatch(html, /<link rel="icon"/)
  const mindCareTextCount = (html.match(/>MindCare</g) || []).length
  assert.equal(mindCareTextCount, 2, 'expected the "MindCare" text label in both header and footer when no logo is set')
})

test('the "MindCare" text label disappears wherever a logo image is set, independently for header and footer', async () => {
  const headerOnly = await renderIndex({ ...baseContent, branding: { headerLogoImage: '/uploads/content/header-logo.png' } })
  assert.equal((headerOnly.match(/>MindCare</g) || []).length, 1, 'footer keeps its text label since only the header logo is set')

  const both = await renderIndex({
    ...baseContent,
    branding: { headerLogoImage: '/uploads/content/header-logo.png', footerLogoImage: '/uploads/content/footer-logo.png' },
  })
  assert.equal((both.match(/>MindCare</g) || []).length, 0, 'both text labels are hidden once both logos are set')
})

test('header and footer logos are independent — setting one does not affect the other', async () => {
  const headerOnly = await renderIndex({ ...baseContent, branding: { headerLogoImage: '/uploads/content/header-logo.png' } })
  assert.match(headerOnly, /<img src="\/uploads\/content\/header-logo\.png" alt="MindCare" class="h-8 w-auto">/)
  assert.doesNotMatch(headerOnly, /<img src="\/uploads\/content\/header-logo\.png" alt="MindCare" class="h-7 w-auto">/)
  // Footer still has no logo configured, so it keeps the default icon box.
  const footerIconBoxCount = (headerOnly.match(/w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-ocean-500/g) || []).length
  assert.equal(footerIconBoxCount, 1)

  const both = await renderIndex({
    ...baseContent,
    branding: { headerLogoImage: '/uploads/content/header-logo.png', footerLogoImage: '/uploads/content/footer-logo.png' },
  })
  assert.match(both, /<img src="\/uploads\/content\/header-logo\.png" alt="MindCare" class="h-8 w-auto">/)
  assert.match(both, /<img src="\/uploads\/content\/footer-logo\.png" alt="MindCare" class="h-7 w-auto">/)
})

test('with a favicon configured, a <link rel="icon"> is added pointing at it', async () => {
  const html = await renderIndex({ ...baseContent, branding: { faviconImage: '/uploads/content/favicon123.png' } })
  assert.match(html, /<link rel="icon" href="\/uploads\/content\/favicon123\.png">/)
})

// Multer only parses fields when the request is actually multipart/form-data;
// building the body by hand here since no file needs to be attached to
// exercise the clear-checkbox branch.
function postMultipart(pathname, fields) {
  const app = express()
  app.use('/admin/content', require('../src/routes/admin/content'))

  const boundary = '----testBoundary123'
  let body = ''
  for (const [key, value] of Object.entries(fields)) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
  }
  body += `--${boundary}--\r\n`
  const bodyBuffer = Buffer.from(body, 'utf8')

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length,
        },
      }, res => {
        res.resume()
        res.on('end', () => server.close(() => resolve(res)))
      })
      req.on('error', err => server.close(() => reject(err)))
      req.end(bodyBuffer)
    })
  })
}

test('clearing one logo checkbox resets only that logo, leaving the other logo and favicon untouched', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  try {
    const seeded = JSON.parse(before)
    seeded.branding = {
      headerLogoImage: '/uploads/content/old-header.png',
      footerLogoImage: '/uploads/content/old-footer.png',
      faviconImage: '/uploads/content/old-favicon.png',
    }
    fs.writeFileSync(contentPath, JSON.stringify(seeded, null, 2))

    const res = await postMultipart('/admin/content/branding', { clear_headerLogoImage: 'on' })
    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.location, '/admin/content?saved=branding')

    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    assert.equal(saved.branding.headerLogoImage, '')
    assert.equal(saved.branding.footerLogoImage, '/uploads/content/old-footer.png')
    assert.equal(saved.branding.faviconImage, '/uploads/content/old-favicon.png')
  } finally {
    fs.writeFileSync(contentPath, before)
  }
})

// Regression test for a real bug: uploading several files with the same
// extension in one multipart request could make multer's filename callback
// (Date.now() + ext, millisecond resolution) generate the identical filename
// for more than one file, so the later file silently overwrote the earlier
// one on disk and every field ended up pointing at the same last-written file.
function postMultipartFiles(pathname, files) {
  const app = express()
  app.use('/admin/content', require('../src/routes/admin/content'))

  const boundary = '----testFileBoundary456'
  const parts = []
  for (const [fieldName, { filename, contentType, data }] of Object.entries(files)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
    ))
    parts.push(data)
    parts.push(Buffer.from('\r\n'))
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`))
  const bodyBuffer = Buffer.concat(parts)

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuffer.length,
        },
      }, res => {
        res.resume()
        res.on('end', () => server.close(() => resolve(res)))
      })
      req.on('error', err => server.close(() => reject(err)))
      req.end(bodyBuffer)
    })
  })
}

test('uploading header logo, footer logo, and favicon together (same extension) saves 3 distinct files, not the last one for all three', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  const writtenFiles = []
  try {
    const res = await postMultipartFiles('/admin/content/branding', {
      headerLogoImage: { filename: 'header.png', contentType: 'image/png', data: tinyPng },
      footerLogoImage: { filename: 'footer.png', contentType: 'image/png', data: tinyPng },
      faviconImage:    { filename: 'favicon.png', contentType: 'image/png', data: tinyPng },
    })
    assert.equal(res.statusCode, 302)

    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    const { headerLogoImage, footerLogoImage, faviconImage } = saved.branding
    writtenFiles.push(headerLogoImage, footerLogoImage, faviconImage)

    assert.ok(headerLogoImage, 'headerLogoImage should be saved')
    assert.ok(footerLogoImage, 'footerLogoImage should be saved')
    assert.ok(faviconImage, 'faviconImage should be saved')
    // The actual bug: all three ended up with the identical filename.
    assert.notEqual(headerLogoImage, footerLogoImage, 'header and footer logos must not collide onto the same file')
    assert.notEqual(headerLogoImage, faviconImage, 'header logo and favicon must not collide onto the same file')
    assert.notEqual(footerLogoImage, faviconImage, 'footer logo and favicon must not collide onto the same file')

    for (const relPath of [headerLogoImage, footerLogoImage, faviconImage]) {
      const absPath = path.join(__dirname, '..', 'public', relPath)
      assert.ok(fs.existsSync(absPath), `${relPath} should exist on disk`)
    }
  } finally {
    fs.writeFileSync(contentPath, before)
    for (const relPath of writtenFiles) {
      if (relPath) fs.rmSync(path.join(__dirname, '..', 'public', relPath), { force: true })
    }
  }
})

function getAdminContent() {
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
      http.get({ hostname: '127.0.0.1', port: server.address().port, path: '/admin/content' }, res => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { body += chunk })
        res.on('end', () => server.close(() => resolve({ res, body })))
      }).on('error', err => server.close(() => reject(err)))
    })
  })
}

test('logo/favicon pickers use the exact same current/new-image preview pattern as the section background pickers', async () => {
  const { res, body } = await getAdminContent()
  assert.equal(res.statusCode, 200)
  for (const field of ['headerLogoImage', 'footerLogoImage', 'faviconImage']) {
    assert.match(body, new RegExp(`id="curimgbox_${field}"`))
    assert.match(body, new RegExp(`id="newimgbox_${field}"`))
    assert.match(body, new RegExp(`name="${field}"[^>]*onchange="previewBgImage\\(this,'${field}'\\)"`))
    assert.match(body, new RegExp(`name="clear_${field}"`))
  }
})

test('saving branding without touching the fields preserves the existing header/footer logos and favicon', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  try {
    const seeded = JSON.parse(before)
    seeded.branding = {
      headerLogoImage: '/uploads/content/kept-header.png',
      footerLogoImage: '/uploads/content/kept-footer.png',
      faviconImage: '/uploads/content/kept-favicon.png',
    }
    fs.writeFileSync(contentPath, JSON.stringify(seeded, null, 2))

    const res = await postMultipart('/admin/content/branding', {})
    assert.equal(res.statusCode, 302)

    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    assert.equal(saved.branding.headerLogoImage, '/uploads/content/kept-header.png')
    assert.equal(saved.branding.footerLogoImage, '/uploads/content/kept-footer.png')
    assert.equal(saved.branding.faviconImage, '/uploads/content/kept-favicon.png')
  } finally {
    fs.writeFileSync(contentPath, before)
  }
})

function renderAdminLogin(content) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'admin', 'login.ejs'),
      { content, error: false },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

function renderAdminSidebar(content) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'partials', 'admin-sidebar.ejs'),
      { content, page: 'dashboard', session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' } },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('admin login uses the footer logo without the old logo text', async () => {
  const html = await renderAdminLogin({ branding: { headerLogoImage: '/uploads/content/header-logo.png', footerLogoImage: '/uploads/content/footer-logo.png' } })
  assert.ok(html.includes('<img src="/uploads/content/footer-logo.png" alt="MindCare" class="brand-img">'))
  assert.equal(html.includes('<img src="/uploads/content/header-logo.png"'), false)
  assert.equal(html.includes('font-size:18px;font-weight:700;margin:0;line-height:1.2;">MindCare</p>'), false)
})

test('admin sidebar uses the footer logo without the old logo text', async () => {
  const html = await renderAdminSidebar({ branding: { headerLogoImage: '/uploads/content/header-logo.png', footerLogoImage: '/uploads/content/footer-logo.png' } })
  assert.ok(html.includes('<img src="/uploads/content/footer-logo.png" alt="MindCare" class="h-9 w-auto max-w-[160px] object-contain">'))
  assert.equal(html.includes('<img src="/uploads/content/header-logo.png"'), false)
  assert.equal(html.includes('class="font-bold leading-tight" style="color:#fff">MindCare</p>'), false)
})
