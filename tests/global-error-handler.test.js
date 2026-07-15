const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('server.js registers a global error handler after every route, using the logger and a detail-free response', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8')

  // The 4-arg (err, req, res, next) signature is what makes Express treat
  // this as an error handler rather than a normal route/middleware.
  assert.match(source, /app\.use\(\(err, req, res, next\) => \{/)
  assert.match(source, /logError\(`Unhandled error on \$\{req\.method\} \$\{req\.originalUrl\}`, err\)/)
  // Must never echo err.message/err.stack into the response.
  assert.doesNotMatch(source.match(/app\.use\(\(err, req, res, next\)[\s\S]*?\n\}\)/)[0], /err\.message|err\.stack/)

  const errorHandlerIndex = source.indexOf('app.use((err, req, res, next)')
  const lastRouteMountIndex = source.lastIndexOf("app.use('/admin/audit-log'")
  assert.ok(errorHandlerIndex > lastRouteMountIndex, 'error handler must be registered after all route mounts to actually catch their errors')
})
