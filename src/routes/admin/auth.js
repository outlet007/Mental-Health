const express = require('express')
const router  = express.Router()
const path    = require('path')
const bcrypt  = require('bcryptjs')
const rateLimit = require('express-rate-limit')
const { verifyToken } = require('../../middleware/csrf')
const { readJSON } = require('../../utils/json-store')

const dataDir = path.join(__dirname, '../../../data')
function read(file) { return readJSON(path.join(dataDir, file)) }

// Never matches any real password — compared against when no account is found,
// so login always pays the same bcrypt cost and response time doesn't leak
// whether a username exists.
const DUMMY_HASH = '$2b$10$n5sIot/K4bANCU1f9cI2N.965rednbZ.FcAY2q0WltNlBdfIM.2Ba'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง',
})

router.get('/login', (req, res) => {
  if (req.session && req.session.adminId) return res.redirect('/admin')
  res.render('admin/login', { error: req.query.error === '1' })
})

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body
  const uname = (username || '').trim().toLowerCase()

  let user     = null
  let userType = 'admin'

  const admins = read('admins.json')
  user = admins.find(a => a.username === uname && a.status === 'active') || null

  if (!user) {
    const counselors = read('counselors.json')
    const c = counselors.find(c => c.username === uname && c.status === 'active' && c.password)
    if (c) { user = c; userType = 'counselor' }
  }

  const match = await bcrypt.compare(password, (user && user.password) || DUMMY_HASH)
  if (!user || !user.password || !match) return res.redirect('/admin/login?error=1')

  req.session.adminId     = user.id
  req.session.adminName   = user.name
  req.session.adminRole   = userType === 'counselor' ? 'นักจิตวิทยา' : (user.role || 'admin')
  req.session.adminEmail  = user.email
  req.session.adminPhoto  = userType === 'counselor' ? (user.photo || '') : ''
  req.session.adminAvatar = userType === 'counselor' ? (user.avatar || '') : ''
  req.session.userType    = userType
  req.session.counselorId = userType === 'counselor' ? user.id : null

  res.redirect('/admin')
})

router.post('/logout', verifyToken, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'))
})

module.exports = router
