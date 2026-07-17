const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// Optional encryption at rest for every JSON data file. Off by default (key
// unset) so this doesn't break any environment that hasn't set
// DATA_ENCRYPTION_KEY yet — same graceful-fallback approach as SESSION_SECRET.
const ALGO = 'aes-256-gcm'
const keyHex = process.env.DATA_ENCRYPTION_KEY
let key = null
if (keyHex) {
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    console.warn('[json-store] DATA_ENCRYPTION_KEY is set but is not 64 hex characters (32 bytes) — ignoring it, data will be stored as plaintext.')
  } else {
    key = Buffer.from(keyHex, 'hex')
  }
}
if (!key) {
  console.warn('[json-store] DATA_ENCRYPTION_KEY is not set — data files will be stored as plaintext. Set it in .env to encrypt data at rest.')
}

function encrypt(text) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decrypt(payload) {
  const buf = Buffer.from(payload, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// Corruption (or a mid-write crash before the atomic rename below existed)
// should fail loudly, not silently fall back to empty data — returning `[]`
// for a file that failed to parse would look like "no appointments" and a
// subsequent write could wipe out data that's still recoverable by hand.
function corrupt(filePath, cause) {
  console.error(`[json-store] ${filePath} is unreadable or corrupted:`, cause.message)
  const err = new Error(`Data file is unreadable or corrupted: ${path.basename(filePath)}`)
  err.cause = cause
  return err
}

function readJSON(filePath, fallback) {
  let raw
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback
    throw err
  }
  if (!key) {
    try { return JSON.parse(raw) } catch (err) { throw corrupt(filePath, err) }
  }
  // Key is configured: try the encrypted form first, but fall back to plain
  // JSON so files written before encryption was turned on keep working —
  // the next write re-saves them encrypted, so this migrates itself lazily.
  try {
    return JSON.parse(decrypt(raw))
  } catch (decryptErr) {
    try { return JSON.parse(raw) } catch (parseErr) { throw corrupt(filePath, decryptErr) }
  }
}

// Atomic write: write to a unique temp file in the same directory, then
// rename over the real path. rename() is atomic on the same filesystem, so
// a crash mid-write leaves either the old file or the new one intact —
// never a half-written, corrupted one.
// Windows occasionally holds a brief exclusive lock on a just-created file
// (antivirus/indexer scanning it) which makes an immediate rename() fail
// with EPERM/EBUSY even though nothing is wrong — retrying a few times with
// a short delay clears it without weakening the atomicity guarantee (the
// temp file is still fully written before any rename attempt).
function renameWithRetry(tmpPath, filePath, attemptsLeft = 5) {
  try {
    fs.renameSync(tmpPath, filePath)
  } catch (err) {
    if (attemptsLeft <= 0 || (err.code !== 'EPERM' && err.code !== 'EBUSY')) {
      try { fs.unlinkSync(tmpPath) } catch {}
      throw err
    }
    const waitUntil = Date.now() + 20
    while (Date.now() < waitUntil) { /* brief synchronous busy-wait */ }
    renameWithRetry(tmpPath, filePath, attemptsLeft - 1)
  }
}

function writeJSON(filePath, data) {
  const text = JSON.stringify(data, null, 2)
  const out = key ? encrypt(text) : text
  const tmpPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`)
  fs.writeFileSync(tmpPath, out)
  renameWithRetry(tmpPath, filePath)
}

// data/*.json files containing real client PII (admins, appointments,
// clients, contacts, counselors, surveys, the deletion audit log) are
// gitignored on purpose (see the PII git-history scrub, 2026-07-13) — a
// fresh `git clone` has none of them, so every route that reads one with
// no fallback (most don't pass one) would crash with ENOENT on first
// request. Seed each as an empty array on boot; any file that already
// exists (every real deployment so far) is left untouched.
const SEEDABLE_DATA_FILES = [
  'admins.json', 'appointments.json', 'audit-log.json', 'clients.json',
  'contacts.json', 'counselors.json', 'surveys.json',
]

function ensureDataFiles(dataDir) {
  for (const file of SEEDABLE_DATA_FILES) {
    const filePath = path.join(dataDir, file)
    if (!fs.existsSync(filePath)) writeJSON(filePath, [])
  }
}

module.exports = { readJSON, writeJSON, ensureDataFiles }
