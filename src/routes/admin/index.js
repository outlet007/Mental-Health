const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '../../../data')

function readData(file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
}

// Dashboard
router.get('/', (req, res) => {
  const counselors  = readData('counselors.json')
  const clients     = readData('clients.json')
  const appointments = readData('appointments.json')

  const stats = {
    totalCounselors:  counselors.filter(c => c.isApproved).length,
    pendingApproval:  counselors.filter(c => !c.isApproved).length,
    totalClients:     clients.length,
    activeClients:    clients.filter(c => c.status === 'active').length,
    totalAppointments: appointments.length,
    todayAppointments: appointments.filter(a => {
      const today = new Date().toISOString().split('T')[0]
      return a.date === today
    }).length,
    pendingAppointments: appointments.filter(a => a.status === 'pending').length,
    revenue: appointments
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + a.fee, 0),
  }

  const recentAppointments = appointments
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)

  res.render('admin/dashboard', {
    page: 'dashboard',
    title: 'แดชบอร์ด',
    stats,
    recentAppointments,
  })
})

module.exports = router
