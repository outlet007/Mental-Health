const express = require('express')
const router  = express.Router()
const { ensureToken, verifyToken } = require('../../middleware/csrf')
router.use(ensureToken)
router.use(verifyToken)
const { matchesSearch } = require('../../utils/search')
const path    = require('path')
const bcrypt  = require('bcryptjs')
const { logDeletion } = require('../../utils/audit-log')
const { readJSON, writeJSON } = require('../../utils/json-store')

const dataFile = path.join(__dirname, '../../../data/admins.json')

function readData()   { return readJSON(dataFile) }
function writeData(d) { writeJSON(dataFile, d) }
function isSuperAdminRole(role) { return ['superadmin', 'admin'].includes(role) }
function activeSuperAdminCount(data) {
  return data.filter(a => isSuperAdminRole(a.role) && a.status === 'active').length
}

router.get('/', (req, res) => {
  const { search, role_filter, status_filter } = req.query
  let admins = readData()

  if (search) {
    admins = admins.filter(a => matchesSearch([
      a.name,
      a.username,
      a.email,
      a.phone,
    ], search))
  }
  if (role_filter) {
    admins = admins.filter(a =>
      role_filter === 'superadmin'
        ? ['superadmin','admin'].includes(a.role)
        : a.role === role_filter
    )
  }
  if (status_filter) {
    admins = admins.filter(a => a.status === status_filter)
  }

  res.render('admin/admins', {
    page: 'admins', title: 'จัดการผู้ใช้',
    admins, query: req.query,
  })
})

router.post('/create', async (req, res) => {
  const { username, password, name, department, email, phone, role } = req.body
  if (!username || !password || !name) return res.redirect('/admin/admins?error=missing')
  // Hash before reading the file: bcrypt.hash awaits (yields to the event
  // loop), so a read-then-await-then-write here could interleave with another
  // concurrent request's write and silently lose one of the two updates.
  // Doing the hash first keeps the read/check/write itself fully synchronous.
  const hashed = await bcrypt.hash(password, 10)
  const data = readData()
  if (data.find(a => a.username === username.trim().toLowerCase()))
    return res.redirect('/admin/admins?error=duplicate')
  data.push({
    id:         'adm' + Date.now().toString().slice(-6),
    username:   username.trim().toLowerCase(),
    name:       name.trim(),
    department: (department || '').trim(),
    email:      (email || '').trim().toLowerCase(),
    phone:      (phone || '').trim(),
    password:   hashed,
    role:       role || 'admin',
    status:     'active',
    createdAt:  new Date().toISOString().split('T')[0],
  })
  writeData(data)
  res.redirect('/admin/admins?created=1')
})

router.post('/:id/edit', async (req, res) => {
  const { username, password, name, department, email, phone, role, status } = req.body
  // Hash before reading the file — see the /create route above for why.
  const hashedPassword = (password && password.trim()) ? await bcrypt.hash(password.trim(), 10) : null
  const data = readData()
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (status === 'inactive' && data[idx].status === 'active' && isSuperAdminRole(data[idx].role) && activeSuperAdminCount(data) <= 1) {
      return res.redirect('/admin/admins?error=last_active')
    }
    if (username) data[idx].username = username.trim().toLowerCase()
    data[idx].name       = (name || '').trim()
    data[idx].department = (department || '').trim()
    data[idx].email      = (email || '').trim().toLowerCase()
    data[idx].phone      = (phone || '').trim()
    data[idx].role       = role || data[idx].role
    data[idx].status     = status || data[idx].status
    if (hashedPassword) {
      data[idx].password = hashedPassword
    }
    writeData(data)
  }
  res.redirect('/admin/admins?updated=1')
})

router.post('/:id/toggle-status', (req, res) => {
  const data = readData()
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    const admin = data[idx]
    if (admin.status === 'active' && isSuperAdminRole(admin.role) && activeSuperAdminCount(data) <= 1) {
      return res.redirect('/admin/admins?error=last_active')
    }
    admin.status = admin.status === 'active' ? 'inactive' : 'active'
    writeData(data)
  }
  res.redirect('/admin/admins?updated=1')
})

router.post('/:id/delete', (req, res) => {
  const data = readData()
  if (data.length <= 1) return res.redirect('/admin/admins?error=last')
  const admin = data.find(a => a.id === req.params.id)
  writeData(data.filter(a => a.id !== req.params.id))
  if (admin) {
    logDeletion({ entityType: 'admin', entityId: admin.id, entityName: admin.name, reason: req.body.reason, req })
  }
  res.redirect('/admin/admins')
})

module.exports = router
