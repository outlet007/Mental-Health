const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { runBackup, rotateOldBackups } = require('../src/utils/backup')

function makeTempDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mindcare-backup-test-'))
  const dataDir = path.join(root, 'data')
  const uploadsDir = path.join(root, 'uploads')
  const backupsDir = path.join(root, 'backups')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.mkdirSync(uploadsDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, 'clients.json'), JSON.stringify([{ id: 'cl001', name: 'Test Client' }]))
  fs.writeFileSync(path.join(uploadsDir, 'photo.jpg'), 'fake-image-bytes')
  return { root, dataDir, uploadsDir, backupsDir }
}

test('runBackup copies data/ and uploads/ into a timestamped snapshot directory', () => {
  const { dataDir, uploadsDir, backupsDir } = makeTempDirs()
  const result = runBackup(new Date('2026-07-15T10:00:00.000Z'), { dataDir, uploadsDir, backupsDir })

  assert.equal(result.ok, true)
  assert.ok(fs.existsSync(result.path))
  const copiedClients = JSON.parse(fs.readFileSync(path.join(result.path, 'data', 'clients.json'), 'utf8'))
  assert.deepEqual(copiedClients, [{ id: 'cl001', name: 'Test Client' }])
  assert.equal(fs.readFileSync(path.join(result.path, 'uploads', 'photo.jpg'), 'utf8'), 'fake-image-bytes')
})

test('runBackup does not mutate the source data/uploads directories', () => {
  const { dataDir, uploadsDir, backupsDir } = makeTempDirs()
  const beforeClients = fs.readFileSync(path.join(dataDir, 'clients.json'), 'utf8')
  runBackup(new Date(), { dataDir, uploadsDir, backupsDir })
  assert.equal(fs.readFileSync(path.join(dataDir, 'clients.json'), 'utf8'), beforeClients)
})

test('runBackup reports ok: false without throwing when the data directory does not exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mindcare-backup-test-'))
  const result = runBackup(new Date(), {
    dataDir: path.join(root, 'does-not-exist'),
    uploadsDir: path.join(root, 'uploads'),
    backupsDir: path.join(root, 'backups'),
  })
  assert.equal(result.ok, false)
})

test('old snapshots beyond the retention count are removed, oldest first', () => {
  const before = process.env.BACKUP_RETENTION_COUNT
  process.env.BACKUP_RETENTION_COUNT = '2'
  delete require.cache[require.resolve('../src/utils/backup')]
  const { runBackup: runBackupWithRetention2 } = require('../src/utils/backup')

  try {
    const { dataDir, uploadsDir, backupsDir } = makeTempDirs()
    const r1 = runBackupWithRetention2(new Date('2026-07-01T00:00:00.000Z'), { dataDir, uploadsDir, backupsDir })
    const r2 = runBackupWithRetention2(new Date('2026-07-02T00:00:00.000Z'), { dataDir, uploadsDir, backupsDir })
    const r3 = runBackupWithRetention2(new Date('2026-07-03T00:00:00.000Z'), { dataDir, uploadsDir, backupsDir })

    const remaining = fs.readdirSync(backupsDir).sort()
    assert.equal(remaining.length, 2, 'only 2 snapshots should be kept')
    assert.ok(!fs.existsSync(r1.path), 'the oldest snapshot should have been removed')
    assert.ok(fs.existsSync(r2.path) && fs.existsSync(r3.path), 'the 2 newest snapshots should remain')
  } finally {
    if (before === undefined) delete process.env.BACKUP_RETENTION_COUNT
    else process.env.BACKUP_RETENTION_COUNT = before
    delete require.cache[require.resolve('../src/utils/backup')]
  }
})

test('rotateOldBackups is a no-op (does not throw) when the backups directory does not exist yet', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mindcare-backup-test-'))
  assert.deepEqual(rotateOldBackups(path.join(root, 'never-created')), [])
})
