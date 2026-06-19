const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')

const dataFile = path.join(__dirname, '../../data/contacts.json')

function readData()   { return JSON.parse(fs.readFileSync(dataFile, 'utf8')) }
function writeData(d) { fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)) }

router.post('/', (req, res) => {
  const { name, phone, email, studentId, concern, type } = req.body
  if (!name || !studentId || !phone || !email) return res.redirect('/?error=missing#book')

  const data = readData()
  data.push({
    id:          'req' + Date.now().toString().slice(-8),
    name:        name.trim(),
    studentId:   (studentId || '').trim(),
    phone:       phone.trim(),
    email:       (email || '').trim(),
    concern:     concern || '',
    sessionType: type || 'online',
    status:      'new',
    note:        '',
    createdAt:   new Date().toISOString().split('T')[0],
  })
  writeData(data)
  res.redirect('/?sent=1#book')
})

module.exports = router
