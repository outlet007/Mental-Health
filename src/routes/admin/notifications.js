const express = require('express')
const router  = express.Router()
const { ensureToken, verifyToken } = require('../../middleware/csrf')
router.use(ensureToken)
router.use(verifyToken)
const path    = require('path')
const { readJSON } = require('../../utils/json-store')

const dataDir = path.join(__dirname, '../../../data')
function read(file) { return readJSON(path.join(dataDir, file)) }

router.get('/', (req, res) => {
  const contacts     = read('contacts.json')
  const appointments = read('appointments.json')

  const newContacts         = contacts.filter(c => c.status === 'new').length
  const pendingAppointments = appointments.filter(a => a.status === 'pending').length

  // ผู้รับบริการที่รอโอนย้าย (admin เท่านั้น — เป็นฟีเจอร์ admin-only เหมือนปุ่มโอนย้าย)
  let pendingTransferClients = 0
  if (req.session.userType !== 'counselor') {
    const inactiveCounselorIds = new Set(
      read('counselors.json').filter(c => c.status === 'inactive').map(c => c.id)
    )
    pendingTransferClients = new Set(
      appointments
        .filter(a => (a.status === 'pending' || a.status === 'confirmed') && inactiveCounselorIds.has(a.counselorId))
        .map(a => a.clientId)
    ).size
  }

  res.json({ newContacts, pendingAppointments, pendingTransferClients })
})

module.exports = router
