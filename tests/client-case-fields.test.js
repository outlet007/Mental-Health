const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('client and intake forms capture nickname and faculty for case reports', () => {
  const clientsView = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'clients.ejs'), 'utf8')
  const publicView = fs.readFileSync(path.join(__dirname, '..', 'views', 'index.ejs'), 'utf8')
  const clientsRoute = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', 'clients.js'), 'utf8')
  const contactRoute = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'contact.js'), 'utf8')

  assert.match(clientsView, /name="nickname" id="f_nickname"/)
  assert.match(clientsView, /name="facultyIndex" id="f_facultyIndex"/)
  assert.match(publicView, /name="nickname"/)
  assert.ok(clientsRoute.includes("nickname:      (nickname || '').trim()"))
  assert.ok(clientsRoute.includes("faculty:       facultySelection?.faculty || ''"))
  assert.ok(contactRoute.includes('nickname: contact.nickname'))
})