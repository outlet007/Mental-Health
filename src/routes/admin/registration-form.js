const express = require('express')
const router = express.Router()
const { ensureToken, verifyToken } = require('../../middleware/csrf')
const { sanitizeContentTree } = require('../../utils/sanitize-content')
router.use(ensureToken)
router.use(verifyToken)
const path = require('path')
const { readJSON, writeJSON } = require('../../utils/json-store')

const dataFile = path.join(__dirname, '../../../data/content.json')

function readData() { return readJSON(dataFile) }
function writeData(data) { writeJSON(dataFile, sanitizeContentTree(data)) }

function readItems(value) {
  return [].concat(value || []).map(item => item.trim()).filter(Boolean)
}

const FORM_TEXT_FIELDS = [
  'successHeading',
  'successText',
  'nameLabel',
  'namePlaceholder',
  'studentIdLabel',
  'studentIdPlaceholder',
  'phoneLabel',
  'phonePlaceholder',
  'emailLabel',
  'emailPlaceholder',
  'concernLabel',
  'typeLabel',
  'onlineLabel',
  'phoneSessionLabel',
  'onsiteLabel',
  'pdpaHeading',
  'pdpaText',
  'pdpaCheckbox',
  'submitLabel',
]

function readFormTexts(body, current = {}) {
  const formTexts = { ...current }
  FORM_TEXT_FIELDS.forEach(field => {
    const value = (body['formText_' + field] || '').trim()
    if (value) formTexts[field] = value
  })
  return formTexts
}

function readSessionTypes(body) {
  return {
    online: body.sessionTypeEnabled_online === 'on',
    phone:  body.sessionTypeEnabled_phone === 'on',
    onsite: body.sessionTypeEnabled_onsite === 'on',
  }
}

function readBookSettings(body, currentBook, concernField) {
  return {
    ...currentBook,
    heading: (body.bookHeading || '').trim(),
    subtext: (body.bookSubtext || '').trim(),
    formHeading: (body.bookFormHeading || '').trim(),
    concernOptions: readItems(body[concernField]),
    sessionTypes: readSessionTypes(body),
    formTexts: readFormTexts(body, currentBook.formTexts || {}),
  }
}

router.get('/', (req, res) => {
  const content = readData()
  if (!content.en) content.en = {}
  res.render('admin/registration-form', {
    page: 'registration-form',
    title: 'จัดการฟอร์มลงทะเบียนเพื่อขอรับบริการให้คำปรึกษา',
    content,
    query: req.query,
  })
})

router.post('/', (req, res) => {
  const data = readData()
  data.book = readBookSettings(req.body, data.book || {}, 'bookConcernOption')
  writeData(data)
  res.redirect('/admin/registration-form?saved=th')
})

router.post('/en', (req, res) => {
  const data = readData()
  if (!data.en) data.en = {}
  data.en.book = readBookSettings(req.body, data.en.book || {}, 'bookConcernOptionEn')
  writeData(data)
  res.redirect('/admin/registration-form?saved=en')
})

module.exports = router
