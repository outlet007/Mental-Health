const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('admin counselor form restricts title to the supported dropdown options', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'admin', 'counselors.ejs'),
    'utf8'
  )

  assert.match(source, /<select name="title" id="f_title" class="inp" required>/)
  assert.match(source, /<option value="จิตแพทย์">จิตแพทย์<\/option>/)
  assert.match(source, /<option value="นักจิตวิทยาคลินิก">นักจิตวิทยาคลินิก<\/option>/)
  assert.doesNotMatch(source, /<input[^>]+name="title"[^>]*>/)
})

test('new counselor accounts require login credentials and are activated immediately', () => {
  const viewSource = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'admin', 'counselors.ejs'),
    'utf8'
  )
  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'routes', 'admin', 'counselors.js'),
    'utf8'
  )

  assert.match(viewSource, /name="username" id="f_username"[^>]+required/)
  assert.match(viewSource, /name="password" id="f_password"[^>]+minlength="8" required/)
  assert.match(viewSource, /อนุมัติและเปิดใช้งานทันที/)
  assert.doesNotMatch(viewSource, /name="isApproved"/)

  assert.match(routeSource, /if \(!uname \|\| pass\.length < 8\)/)
  assert.match(routeSource, /status:\s+'active'/)
  assert.match(routeSource, /isApproved:\s+true/)
  assert.match(routeSource, /record\.username = uname/)
  assert.match(routeSource, /record\.password = hashedPassword/)
  assert.match(routeSource, /error=duplicate_username/)
})
