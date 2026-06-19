const COUNSELOR_ALLOWED = [
  '/admin/appointments',
  '/admin/clients',
  '/admin/schedules',
]

module.exports = (req, res, next) => {
  if (!req.session || !req.session.adminId) return res.redirect('/admin/login')

  if (req.session.userType === 'counselor') {
    const allowed = COUNSELOR_ALLOWED.some(p => req.originalUrl.startsWith(p))
    if (!allowed) return res.redirect('/admin/appointments')
  }

  next()
}
