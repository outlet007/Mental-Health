const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  ONLINE_REGISTRATION,
  WALK_IN,
  normalizeRequestChannel,
} = require('../src/utils/request-channel')

test('request channel defaults missing and unsupported values to online registration', () => {
  assert.equal(normalizeRequestChannel(undefined), ONLINE_REGISTRATION)
  assert.equal(normalizeRequestChannel('unsupported'), ONLINE_REGISTRATION)
  assert.equal(normalizeRequestChannel(WALK_IN), WALK_IN)
})

test('public requests are saved as online registration and admin edits normalize the submitted channel', () => {
  const publicRoute = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'contact.js'), 'utf8')
  const adminRoute = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', 'contacts.js'), 'utf8')
  const editRoute = adminRoute.slice(adminRoute.indexOf("router.post('/:id/edit'"), adminRoute.indexOf("router.post('/:id/book'"))

  assert.match(publicRoute, /requestChannel: ONLINE_REGISTRATION/)
  assert.match(editRoute, /data\[idx\]\.requestChannel = normalizeRequestChannel\(requestChannel\)/)
})
