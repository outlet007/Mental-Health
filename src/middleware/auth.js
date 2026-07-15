const path = require('path')
const { readJSON } = require('../utils/json-store')

const counselorFile   = path.join(__dirname, '../../data/counselors.json')
const appointmentFile = path.join(__dirname, '../../data/appointments.json')

function readCounselors() {
  return readJSON(counselorFile, [])
}

function readAppointments() {
  return readJSON(appointmentFile, [])
}

const COUNSELOR_ALLOWED = [
  '/admin/appointments',
  '/admin/clients',
  '/admin/schedules',
  '/admin/surveys',
  '/admin/profile',
]

module.exports = (req, res, next) => {
  if (!req.session || !req.session.adminId) return res.redirect('/admin/login')

  if (req.session.userType === 'counselor') {
    const counselor = readCounselors().find(c => c.id === req.session.counselorId)
    if (counselor) {
      req.session.adminName = counselor.name || req.session.adminName
      req.session.adminEmail = counselor.email || req.session.adminEmail
      req.session.adminPhoto = counselor.photo || ''
      req.session.adminAvatar = counselor.avatar || ''
      res.locals.currentCounselor = counselor

      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      res.locals.myTodayApts = readAppointments().filter(a =>
        a.counselorId === counselor.id && a.date === todayStr && a.status !== 'cancelled'
      ).length
    }

    const isDash  = req.originalUrl === '/admin' || req.originalUrl.startsWith('/admin?')
    const allowed = isDash || COUNSELOR_ALLOWED.some(p => req.originalUrl.startsWith(p))
    if (!allowed) return res.redirect('/admin')
  }

  next()
}
