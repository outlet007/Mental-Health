const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '../..')
const dataDir      = path.join(projectRoot, 'data')
const uploadsDir   = path.join(projectRoot, 'public', 'uploads')
const backupsDir   = path.join(projectRoot, 'backups')

// How many snapshots to keep — default 28 (a week's worth at the default
// 6-hour interval). Configurable since a busier deployment may want more/
// fewer, or a shorter/longer interval via BACKUP_INTERVAL_HOURS.
const MAX_BACKUPS = parseInt(process.env.BACKUP_RETENTION_COUNT || '28', 10)

function timestamp(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, '-')
}

// Snapshots data/ and public/uploads/ into backups/<timestamp>/. This is a
// LOCAL, same-disk safety net against accidental deletion or a bad edit —
// it does not protect against the disk itself failing, which needs a
// separate offsite copy (see DEPLOYMENT.md) that this code can't set up on
// its own since that requires credentials/infra this process doesn't have.
//
// `dirs` lets tests point at throwaway directories instead of the real
// data/uploads/backups paths; production code always calls this with no
// arguments and gets the real ones.
function runBackup(now = new Date(), dirs = {}) {
  const src = dirs.dataDir || dataDir
  const uploads = dirs.uploadsDir || uploadsDir
  const backups = dirs.backupsDir || backupsDir

  if (!fs.existsSync(src)) return { ok: false, reason: 'no data directory found' }

  const dest = path.join(backups, timestamp(now))
  fs.mkdirSync(dest, { recursive: true })
  fs.cpSync(src, path.join(dest, 'data'), { recursive: true })
  if (fs.existsSync(uploads)) {
    fs.cpSync(uploads, path.join(dest, 'uploads'), { recursive: true })
  }

  const removed = rotateOldBackups(backups)
  return { ok: true, path: dest, removed }
}

// Snapshot directory names are ISO timestamps with `:`/`.` swapped for `-`,
// which still sort correctly as plain strings — oldest first.
function rotateOldBackups(backups = backupsDir) {
  if (!fs.existsSync(backups)) return []
  const entries = fs.readdirSync(backups, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort()
  const toRemove = entries.slice(0, Math.max(0, entries.length - MAX_BACKUPS))
  for (const name of toRemove) {
    fs.rmSync(path.join(backups, name), { recursive: true, force: true })
  }
  return toRemove
}

module.exports = { runBackup, rotateOldBackups, backupsDir }
