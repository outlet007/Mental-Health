const fs = require('fs')
const path = require('path')

const counselorFile = path.join(__dirname, '../../data/counselors.json')

function readCounselors() {
  if (!fs.existsSync(counselorFile)) return []
  try { return JSON.parse(fs.readFileSync(counselorFile, 'utf8')) }
  catch (error) { return [] }
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
    }

    const isDash  = req.originalUrl === '/admin' || req.originalUrl.startsWith('/admin?')
    const allowed = isDash || COUNSELOR_ALLOWED.some(p => req.originalUrl.startsWith(p))
    if (!allowed) return res.redirect('/admin')
  }

  next()
}
