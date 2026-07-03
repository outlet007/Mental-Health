const fs = require('fs')
const path = require('path')

const logFile = path.join(__dirname, '../../data/audit-log.json')

function readLog() {
  return fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : []
}

function logDeletion({ entityType, entityId, entityName, reason, req }) {
  const log = readLog()
  log.push({
    id:         'del-' + Date.now().toString().slice(-8),
    entityType,
    entityId,
    entityName: entityName || '',
    reason:     (reason || '').trim(),
    actorName:  req.session.adminName || req.session.counselorId || '',
    actorRole:  req.session.userType || 'admin',
    deletedAt:  new Date().toISOString(),
  })
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2))
}

module.exports = { logDeletion }
