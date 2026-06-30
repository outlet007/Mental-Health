const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')

const dataDir = path.join(__dirname, '../../../data')
function read(file) { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }

router.get('/', (req, res) => {
  const contacts     = read('contacts.json')
  const appointments = read('appointments.json')

  const newContacts         = contacts.filter(c => c.status === 'new').length
  const pendingAppointments = appointments.filter(a => a.status === 'pending').length

  res.json({ newContacts, pendingAppointments })
})

module.exports = router
