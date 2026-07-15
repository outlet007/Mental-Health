const path = require('path')
const { readJSON } = require('./json-store')

const CONCERN_DEFAULTS = ['ความวิตกกังวล / ความเครียด', 'ภาวะซึมเศร้า', 'ปัญหาความสัมพันธ์', 'ปัญหาครอบครัว', 'ความเศร้าโศก / การสูญเสีย', 'อื่นๆ']

function getConcernOptions() {
  const contentFile = path.join(__dirname, '../../data/content.json')
  const content = readJSON(contentFile, {})
  return Array.isArray(content.book && content.book.concernOptions) && content.book.concernOptions.length
    ? content.book.concernOptions
    : CONCERN_DEFAULTS
}

module.exports = { getConcernOptions }
