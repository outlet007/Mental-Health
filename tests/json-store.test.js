const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

function freshStore(encryptionKey) {
  delete require.cache[require.resolve('../src/utils/json-store')]
  const before = process.env.DATA_ENCRYPTION_KEY
  if (encryptionKey === undefined) delete process.env.DATA_ENCRYPTION_KEY
  else process.env.DATA_ENCRYPTION_KEY = encryptionKey
  const mod = require('../src/utils/json-store')
  if (before === undefined) delete process.env.DATA_ENCRYPTION_KEY
  else process.env.DATA_ENCRYPTION_KEY = before
  return mod
}

function tempFile() {
  return path.join(os.tmpdir(), `json-store-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`)
}

test('writeJSON then readJSON round-trips data (no encryption key set)', () => {
  const { readJSON, writeJSON } = freshStore(undefined)
  const file = tempFile()
  try {
    writeJSON(file, { hello: 'world', n: 42 })
    assert.deepEqual(readJSON(file), { hello: 'world', n: 42 })
    assert.match(fs.readFileSync(file, 'utf8'), /"hello": "world"/, 'plaintext on disk when no key is set')
  } finally {
    fs.rmSync(file, { force: true })
  }
})

test('writeJSON leaves no leftover .tmp file after a successful write', () => {
  const { writeJSON } = freshStore(undefined)
  const file = tempFile()
  try {
    writeJSON(file, [1, 2, 3])
    const dir = path.dirname(file)
    const leftovers = fs.readdirSync(dir).filter(f => f.includes(path.basename(file)) && f.endsWith('.tmp'))
    assert.deepEqual(leftovers, [])
  } finally {
    fs.rmSync(file, { force: true })
  }
})

test('readJSON returns the fallback when the file does not exist', () => {
  const { readJSON } = freshStore(undefined)
  const file = tempFile()
  assert.deepEqual(readJSON(file, []), [])
})

test('readJSON throws (does not silently return empty data) when the file is corrupted', () => {
  const { readJSON } = freshStore(undefined)
  const file = tempFile()
  try {
    fs.writeFileSync(file, '{ this is not valid json')
    assert.throws(() => readJSON(file), /unreadable or corrupted/)
  } finally {
    fs.rmSync(file, { force: true })
  }
})

const KEY = 'a'.repeat(64)

test('with DATA_ENCRYPTION_KEY set, writeJSON stores ciphertext on disk and readJSON decrypts it back', () => {
  const { readJSON, writeJSON } = freshStore(KEY)
  const file = tempFile()
  try {
    writeJSON(file, { secret: 'client PII' })
    const onDisk = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(onDisk, /secret|client PII/, 'plaintext must not appear on disk')
    assert.deepEqual(readJSON(file), { secret: 'client PII' })
  } finally {
    fs.rmSync(file, { force: true })
  }
})

test('a file written before encryption was turned on (legacy plaintext) still reads correctly once a key is set', () => {
  const file = tempFile()
  try {
    const plain = freshStore(undefined)
    plain.writeJSON(file, { legacy: true })

    const encrypted = freshStore(KEY)
    assert.deepEqual(encrypted.readJSON(file), { legacy: true })

    // and the next write migrates it to ciphertext
    encrypted.writeJSON(file, { legacy: true, migrated: true })
    const onDisk = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(onDisk, /legacy|migrated/)
    assert.deepEqual(encrypted.readJSON(file), { legacy: true, migrated: true })
  } finally {
    fs.rmSync(file, { force: true })
  }
})

test('an invalid (non-64-hex-char) DATA_ENCRYPTION_KEY is ignored, falling back to plaintext', () => {
  const { readJSON, writeJSON } = freshStore('not-a-valid-key')
  const file = tempFile()
  try {
    writeJSON(file, { ok: true })
    assert.match(fs.readFileSync(file, 'utf8'), /"ok": true/)
    assert.deepEqual(readJSON(file), { ok: true })
  } finally {
    fs.rmSync(file, { force: true })
  }
})

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'json-store-ensure-'))
}

test('ensureDataFiles seeds every missing data file as an empty array', () => {
  const { readJSON, ensureDataFiles } = freshStore(undefined)
  const dir = tempDir()
  try {
    ensureDataFiles(dir)
    for (const file of ['admins.json', 'appointments.json', 'audit-log.json', 'clients.json', 'contacts.json', 'counselors.json', 'surveys.json']) {
      assert.deepEqual(readJSON(path.join(dir, file)), [], `${file} should be seeded as []`)
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('ensureDataFiles does not overwrite a data file that already has real content', () => {
  const { readJSON, writeJSON, ensureDataFiles } = freshStore(undefined)
  const dir = tempDir()
  try {
    writeJSON(path.join(dir, 'admins.json'), [{ id: 'adm1', username: 'real-admin' }])
    ensureDataFiles(dir)
    assert.deepEqual(readJSON(path.join(dir, 'admins.json')), [{ id: 'adm1', username: 'real-admin' }])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
