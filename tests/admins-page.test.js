const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

function renderAdmins(locals = {}) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'admin', 'admins.ejs'),
      {
        title: 'Admin Users',
        page: 'admins',
        session: { adminName: 'Admin', adminEmail: 'admin@example.com', userType: 'admin' },
        query: {},
        admins: [
          {
            id: 'adm001',
            username: 'admin',
            name: 'Admin User',
            department: 'Center',
            email: 'admin@example.com',
            phone: '0812345678',
            role: 'superadmin',
            status: 'active',
            createdAt: '2026-06-18',
          },
          {
            id: 'adm002',
            username: 'staff',
            name: 'Staff User',
            department: '',
            email: 'staff@example.com',
            phone: '',
            role: 'staff',
            status: 'inactive',
            createdAt: '2026-06-19',
          },
        ],
        ...locals,
      },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('admin users page edit buttons open a complete panel and show status actions', async () => {
  const html = await renderAdmins()

  assert.match(html, /class="act-btn ab-secondary edit-btn"[^>]*type="button"/)
  assert.match(html, /id="f_department"/)
  assert.match(html, /document\.getElementById\('f_department'\)\.value\s*=\s*rec\.department/)
  assert.match(html, /document\.getElementById\('f_department'\)\.value\s*=\s*''/)
  assert.match(html, /action="\/admin\/admins\/adm001\/toggle-status"/)
  assert.match(html, /data-lucide="ban"/)
  assert.match(html, /action="\/admin\/admins\/adm002\/toggle-status"/)
  assert.match(html, /data-lucide="circle-check"/)

  const firstRow = html.match(/<tr>[\s\S]*?adm001[\s\S]*?<\/tr>/)?.[0] || ''
  assert.ok(firstRow.indexOf('/admin/admins/adm001/delete') < firstRow.indexOf('/admin/admins/adm001/toggle-status'))
})

test('admin users route defines toggle status with last active superadmin guard', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', 'admins.js'), 'utf8')

  assert.match(routeSource, /router\.post\('\/:id\/toggle-status'/)
  assert.match(routeSource, /activeSuperAdminCount\(data\) <= 1/)
  assert.match(routeSource, /error=last_active/)
})