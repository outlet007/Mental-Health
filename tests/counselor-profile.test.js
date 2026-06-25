const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const ejs = require('ejs')
const fs = require('node:fs')
const bcrypt = require('bcryptjs')

const dataFile = path.join(__dirname, '..', 'data', 'counselors.json')

function makeApp(session = {}) {
  const app = express()
  app.set('view engine', 'ejs')
  app.set('views', path.join(__dirname, '..', 'views'))
  app.use(express.urlencoded({ extended: true }))
  app.use((req, res, next) => {
    req.session = {
      adminId: 'c001',
      userType: 'counselor',
      counselorId: 'c001',
      adminName: 'Counselor',
      adminEmail: 'counselor@example.com',
      ...session,
    }
    res.locals.session = req.session
    next()
  })
  app.use('/admin/profile', require('../src/routes/admin/profile'))
  return app
}

function request(app, method, pathname, body = '') {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: pathname,
        method,
        headers: body ? {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
        } : {},
      }, res => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { data += chunk })
        res.on('end', () => server.close(() => resolve({ res, body: data })))
      })
      req.on('error', err => server.close(() => reject(err)))
      if (body) req.write(body)
      req.end()
    })
  })
}

test('counselor sidebar shows system profile menu only for counselor users', async () => {
  const html = await new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'partials', 'admin-sidebar.ejs'),
      { page: 'profile', session: { adminName: 'Counselor', adminEmail: 'counselor@example.com', userType: 'counselor' } },
      {},
      (err, rendered) => err ? reject(err) : resolve(rendered)
    )
  })

  assert.match(html, /href="\/admin\/profile"/)
  assert.match(html, /data-lucide="user-cog"/)
  assert.doesNotMatch(html, /href="\/admin\/admins"/)
  assert.doesNotMatch(html, /\?{3,}/)
})

test('counselor profile page renders editable profile fields with readonly username', async () => {
  const { res, body } = await request(makeApp(), 'GET', '/admin/profile')

  assert.equal(res.statusCode, 200)
  assert.match(body, /data-counselor-profile-form="true"/)
  assert.match(body, /action="\/admin\/profile"/)
  assert.match(body, /name="name"/)
  assert.match(body, /name="title"/)
  assert.match(body, /name="email"/)
  assert.match(body, /name="phone"/)
  assert.match(body, /name="bio"/)
  assert.match(body, /name="specialties"/)
  assert.match(body, /name="languages"/)
  assert.match(body, /class="check-flag"/)
  assert.match(body, /viewBox="0 0 24 18"/)
  assert.match(body, /viewBox="0 0 60 36"/)
  assert.match(body, /name="sessionDuration"/)
  assert.match(body, /data-readonly-username="true"/)
  assert.doesNotMatch(body, /name="username"/)
  assert.match(body, /name="password"/)
  assert.match(body, /autocomplete="new-password"/)
  assert.match(body, /class="login-grid"/)
  assert.match(body, /data-password-toggle="true"/)
  assert.match(body, /togglePasswordVisibility\(this\)/)
  assert.match(body, /data-lucide="eye"/)
  assert.match(body, /data-readonly-username="true"><p style="font-size:11px;color:#94a3b8;margin:7px 0 0;">.*?<\/p><\/div><div><label class="lbl" for="f_password">/s, 'readonly username helper stays under username input')
  assert.doesNotMatch(body, /\?{3,}/)
})

test('counselor profile update keeps username readonly and updates password only when provided', async () => {
  const original = fs.readFileSync(dataFile, 'utf8')
  const before = JSON.parse(original).find(c => c.id === 'c001')

  try {
    const payload = new URLSearchParams({
      name: 'Profile Test Name',
      title: 'Profile Test Title',
      email: 'profile-test@example.com',
      phone: '0800000000',
      bio: 'Updated bio',
      specialties: 'Stress, Sleep',
      languages: 'Thai',
      sessionDuration: '45',
      username: 'evil-change',
      password: 'NewSecurePass123',
    }).toString()

    const { res } = await request(makeApp(), 'POST', '/admin/profile', payload)
    assert.equal(res.statusCode, 302)
    assert.equal(res.headers.location, '/admin/profile?updated=1')

    const after = JSON.parse(fs.readFileSync(dataFile, 'utf8')).find(c => c.id === 'c001')
    assert.equal(after.name, 'Profile Test Name')
    assert.equal(after.title, 'Profile Test Title')
    assert.equal(after.email, 'profile-test@example.com')
    assert.equal(after.sessionDuration, 45)
    assert.deepEqual(after.specialties, ['Stress', 'Sleep'])
    assert.equal(after.username, before.username)
    assert.notEqual(after.password, before.password)
    assert.equal(await bcrypt.compare('NewSecurePass123', after.password), true)
  } finally {
    fs.writeFileSync(dataFile, original, 'utf8')
  }
})

test('counselor profile route is allowed by counselor auth middleware', () => {
  const authSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'auth.js'), 'utf8')
  assert.match(authSource, /'\/admin\/profile'/)
})
