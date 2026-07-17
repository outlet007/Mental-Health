// Creates (or resets the password of) an admin login.
//
// data/admins.json is gitignored (see the PII git-history scrub, 2026-07-13)
// so a fresh clone starts with zero admin accounts and no way to log in —
// run this once after a fresh deploy to create the first one.
//
// Usage: node scripts/create-admin.js <username> <password> [name] [email]
// Docker: docker compose exec app node scripts/create-admin.js <username> <password> [name] [email]
const path = require('path')
const bcrypt = require('bcryptjs')
const { readJSON, writeJSON } = require('../src/utils/json-store')

const [, , username, password, name, email] = process.argv

if (!username || !password) {
  console.error('Usage: node scripts/create-admin.js <username> <password> [name] [email]')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}

async function main() {
  const dataFile = path.join(__dirname, '../data/admins.json')
  const admins = readJSON(dataFile, [])
  const cleanUsername = username.trim().toLowerCase()
  const hashed = await bcrypt.hash(password, 10)
  const existing = admins.find(a => a.username === cleanUsername)

  if (existing) {
    existing.password = hashed
    existing.status = 'active'
    writeJSON(dataFile, admins)
    console.log(`Updated password for existing admin "${cleanUsername}".`)
    return
  }

  admins.push({
    id: 'adm' + Date.now().toString().slice(-6),
    username: cleanUsername,
    name: (name || cleanUsername).trim(),
    department: '',
    email: (email || '').trim().toLowerCase(),
    phone: '',
    password: hashed,
    role: 'superadmin',
    status: 'active',
    createdAt: new Date().toISOString().split('T')[0],
  })
  writeJSON(dataFile, admins)
  console.log(`Created admin "${cleanUsername}".`)
}

main()
