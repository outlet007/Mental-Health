const express = require('express')
const router  = express.Router()
const path    = require('path')
const rateLimit = require('express-rate-limit')
const { readJSON, writeJSON } = require('../utils/json-store')

const dataFile = path.join(__dirname, '../../data/contacts.json')

function readData()   { return readJSON(dataFile) }
function writeData(d) { writeJSON(dataFile, d) }

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/', contactLimiter, (req, res) => {
  const { name, phone, email, studentId, concern, type } = req.body
  if (!name || !studentId || !phone || !email || !type) return res.redirect('/?error=missing#book')

  const data = readData()
  data.push({
    id:          'req' + Date.now().toString().slice(-8),
    name:        name.trim(),
    studentId:   (studentId || '').trim(),
    phone:       phone.trim(),
    email:       (email || '').trim(),
    concern:     concern || '',
    sessionType: type,
    status:      'new',
    note:        '',
    createdAt:   new Date().toISOString().split('T')[0],
  })
  writeData(data)
  res.redirect('/?sent=1#book')
})

module.exports = router
