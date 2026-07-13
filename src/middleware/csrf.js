const crypto = require('crypto')

// One token per session (not per-request) so multiple tabs and the back
// button keep working — regenerating per-request would invalidate forms
// rendered a moment earlier in the same session.
//
// req.session may not exist here: in the real app express-session always
// populates it (src/middleware/auth.js already requires req.session.adminId
// before any of these routers are reached), but some route-level unit tests
// mount a router directly without session middleware to test business logic
// in isolation. There's no session to protect in that case, so this is a
// no-op rather than a crash — it does not weaken production behavior.
function ensureToken(req, res, next) {
  if (!req.session) return next()
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex')
  }
  res.locals.csrfToken = req.session.csrfToken
  next()
}

// Multipart (file upload) requests aren't parsed into req.body yet at this
// point in the middleware chain — multer runs later, inside those specific
// routes — so this skips them here and the route itself calls verifyToken
// again after its upload middleware has run.
function verifyToken(req, res, next) {
  if (req.method !== 'POST') return next()
  if (req.is('multipart/form-data')) return next()
  if (!req.session) return next()

  const token = req.body && req.body._csrf
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).send('Forbidden: invalid or missing security token. Please refresh the page and try again.')
  }
  next()
}

module.exports = { ensureToken, verifyToken }
