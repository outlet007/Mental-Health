const sanitizeHtml = require('sanitize-html')

// CMS text fields are intentionally allowed a little inline HTML (see
// tests/content-html-fields.test.js) so admins can bold a word or force a
// line break in hero/footer/FAQ copy. Everything else — script tags, event
// handler attributes, links, images — is stripped. This is the one and only
// allowlist for data/content.json: an admin account being phished/CSRF'd/
// compromised should not be able to plant a payload that runs in every
// visitor's browser on the public site.
const SANITIZE_OPTIONS = {
  allowedTags: ['strong', 'b', 'em', 'i', 'u', 'br'],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
}

function sanitizeString(value) {
  // sanitize-html always renders <br> as self-closing XHTML-style <br />;
  // normalize back to plain <br> since that's what the rest of the codebase
  // (views, existing tests) writes and expects.
  return sanitizeHtml(value, SANITIZE_OPTIONS).replace(/<br\s*\/>/gi, '<br>')
}

// Walks the whole content.json tree (objects/arrays) and sanitizes every
// string leaf — image paths, hex colors, and URLs pass through unchanged
// since they don't contain markup; only fields with actual HTML in them are
// affected. Applying this generically (rather than field-by-field) means a
// newly added text field is protected by default, not only once someone
// remembers to sanitize it explicitly.
function sanitizeContentTree(value) {
  if (typeof value === 'string') return sanitizeString(value)
  if (Array.isArray(value)) return value.map(sanitizeContentTree)
  if (value && typeof value === 'object') {
    const result = {}
    for (const key of Object.keys(value)) result[key] = sanitizeContentTree(value[key])
    return result
  }
  return value
}

module.exports = { sanitizeContentTree, sanitizeString }
