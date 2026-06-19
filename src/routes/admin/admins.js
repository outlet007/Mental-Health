const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const bcrypt  = require('bcryptjs')

const dataFile = path.join(__dirname, '../../../data/admins.json')

function readData()   { return JSON.parse(fs.readFileSync(dataFile, 'utf8')) }
function writeData(d) { fs.writeFileSync(dataFile, JSON.stringify(d, null, 2)) }

router.get('/', (req, res) => {
  const { search, role_filter, status_filter } = req.query
  let admins = readData()

  if (search) {
    const q = search.trim().toLowerCase()
    admins = admins.filter(a =>
      (a.name     || '').toLowerCase().includes(q) ||
      (a.username || '').toLowerCase().includes(q) ||
      (a.email    || '').toLowerCase().includes(q) ||
      (a.phone    || '').includes(q)
    )
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
  const data = readData()
  if (data.find(a => a.username === username.trim().toLowerCase()))
    return res.redirect('/admin/admins?error=duplicate')
  const hashed = await bcrypt.hash(password, 10)
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
  const data = readData()
  const idx  = data.findIndex(a => a.id === req.params.id)
  if (idx !== -1) {
    if (username) data[idx].username = username.trim().toLowerCase()
    data[idx].name       = (name || '').trim()
    data[idx].department = (department || '').trim()
    data[idx].email      = (email || '').trim().toLowerCase()
    data[idx].phone      = (phone || '').trim()
    data[idx].role       = role || data[idx].role
    data[idx].status     = status || data[idx].status
    if (password && password.trim()) {
      data[idx].password = await bcrypt.hash(password.trim(), 10)
    }
    writeData(data)
  }
  res.redirect('/admin/admins?updated=1')
})

router.post('/:id/delete', (req, res) => {
  const data = readData()
  if (data.length <= 1) return res.redirect('/admin/admins?error=last')
  writeData(data.filter(a => a.id !== req.params.id))
  res.redirect('/admin/admins')
})

module.exports = router
