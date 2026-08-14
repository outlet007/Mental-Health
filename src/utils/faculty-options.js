const path = require('path')
const { readJSON } = require('./json-store')

const FACULTY_DEFAULTS_TH = [
  'คณะบริหารธุรกิจ',
  'คณะบัญชี',
  'คณะนิเทศศาสตร์',
  'คณะนิติศาสตร์',
  'คณะมนุษยศาสตร์และการจัดการการท่องเที่ยว',
  'คณะเศรษฐศาสตร์และการลงทุน',
  'คณะวิศวกรรมศาสตร์',
  'คณะสถาปัตยกรรมศาสตร์',
  'คณะศิลปกรรมศาสตร์',
  'คณะเทคโนโลยีสารสนเทศและนวัตกรรม',
  'คณะดิจิทัลมีเดียและศิลปะภาพยนตร์',
  'วิทยาลัยนานาชาติ',
  'อื่น ๆ',
]

const FACULTY_DEFAULTS_EN = [
  'School of Business Administration',
  'School of Accounting',
  'School of Communication Arts',
  'School of Law',
  'School of Humanities and Tourism Management',
  'School of Economics and Investment',
  'School of Engineering',
  'School of Architecture',
  'School of Fine and Applied Arts',
  'School of Information Technology and Innovation',
  'School of Digital Media and Cinematic Arts',
  'International College',
  'Other',
]

function cleanList(value, fallback) {
  return Array.isArray(value) && value.some(item => String(item || '').trim())
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : fallback
}

function buildFacultyOptions(content = {}) {
  const th = cleanList(content.book && content.book.facultyOptions, FACULTY_DEFAULTS_TH)
  const en = cleanList(content.en && content.en.book && content.en.book.facultyOptions, FACULTY_DEFAULTS_EN)
  const length = Math.max(th.length, en.length)
  return Array.from({ length }, (_, index) => ({
    index: String(index),
    th: th[index] || en[index] || '',
    en: en[index] || th[index] || '',
  })).filter(item => item.th || item.en)
}

function getFacultyOptions() {
  const contentFile = path.join(__dirname, '../../data/content.json')
  return buildFacultyOptions(readJSON(contentFile, {}))
}

function resolveFaculty(value, options = getFacultyOptions()) {
  const index = String(value == null ? '' : value).trim()
  const item = options.find(option => option.index === index)
  return item ? { facultyIndex: item.index, faculty: item.th, facultyEn: item.en } : null
}

module.exports = {
  FACULTY_DEFAULTS_TH,
  FACULTY_DEFAULTS_EN,
  buildFacultyOptions,
  getFacultyOptions,
  resolveFaculty,
}
