const fs = require('fs')
const path = require('path')

const CONCERN_DEFAULTS = ['ความวิตกกังวล / ความเครียด', 'ภาวะซึมเศร้า', 'ปัญหาความสัมพันธ์', 'ปัญหาครอบครัว', 'ความเศร้าโศก / การสูญเสีย', 'อื่นๆ']

function getConcernOptions() {
  const contentFile = path.join(__dirname, '../../data/content.json')
  const content = fs.existsSync(contentFile) ? JSON.parse(fs.readFileSync(contentFile, 'utf8')) : {}
  return Array.isArray(content.book && content.book.concernOptions) && content.book.concernOptions.length
    ? content.book.concernOptions
    : CONCERN_DEFAULTS
}

module.exports = { getConcernOptions }
