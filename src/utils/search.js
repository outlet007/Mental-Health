function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u00a0\-_.()\/\\|:@]+/g, '')
}

function flattenValues(values) {
  if (Array.isArray(values)) return values.flatMap(flattenValues)
  return [values]
}

function matchesSearch(values, keyword) {
  const query = normalizeSearchText(keyword)
  if (!query) return true
  return flattenValues(values).some(value => normalizeSearchText(value).includes(query))
}

module.exports = { normalizeSearchText, matchesSearch }
