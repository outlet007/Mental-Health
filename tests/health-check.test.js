const assert = require('node:assert/strict')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const { spawn } = require('node:child_process')

function waitForPort(port, timeoutMs = 8000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ hostname: '127.0.0.1', port, path: '/health', timeout: 500 }, res => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('server did not start in time'))
        setTimeout(tryOnce, 150)
      })
      req.on('timeout', () => req.destroy())
    }
    tryOnce()
  })
}

function getJson(port, urlPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: urlPath }, res => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }) }
        catch (err) { reject(err) }
      })
    }).on('error', reject)
  })
}

test('GET /health returns 200 with status ok when the app and data directory are reachable', async () => {
  const port = 34568
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), SESSION_SECRET: 'test-secret-for-health-check-spawn', DATA_ENCRYPTION_KEY: '' },
  })

  try {
    await waitForPort(port)
    const { status, body } = await getJson(port, '/health')
    assert.equal(status, 200)
    assert.equal(body.status, 'ok')
    assert.equal(typeof body.uptimeSeconds, 'number')
  } finally {
    child.kill('SIGKILL')
  }
})

test('GET /health does not require an admin session (no redirect to login)', async () => {
  const port = 34569
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), SESSION_SECRET: 'test-secret-for-health-check-spawn-2', DATA_ENCRYPTION_KEY: '' },
  })

  try {
    await waitForPort(port)
    const { status } = await getJson(port, '/health')
    assert.equal(status, 200, 'a 302 here would mean it got routed through the admin auth gate by mistake')
  } finally {
    child.kill('SIGKILL')
  }
})
