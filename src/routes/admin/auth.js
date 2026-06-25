const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const bcrypt  = require('bcryptjs')

const dataDir = path.join(__dirname, '../../../data')
function read(file) { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }

router.get('/login', (req, res) => {
  if (req.session && req.session.adminId) return res.redirect('/admin')
  res.render('admin/login', { error: req.query.error === '1' })
})

router.post('/login', async (req, res) => {
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

  if (!user || !user.password) return res.redirect('/admin/login?error=1')

  const match = await bcrypt.compare(password, user.password)
  if (!match) return res.redirect('/admin/login?error=1')

  req.session.adminId     = user.id
  req.session.adminName   = user.name
  req.session.adminRole   = userType === 'counselor' ? 'เธเธฑเธเธเธดเธ•เธงเธดเธ—เธขเธฒ' : (user.role || 'admin')
  req.session.adminEmail  = user.email
  req.session.adminPhoto  = userType === 'counselor' ? (user.photo || '') : ''
  req.session.adminAvatar = userType === 'counselor' ? (user.avatar || '') : ''
  req.session.userType    = userType
  req.session.counselorId = userType === 'counselor' ? user.id : null

  res.redirect('/admin')
})

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'))
})

module.exports = router
