const path = require('path')
const { readJSON, writeJSON } = require('./json-store')

const logFile = path.join(__dirname, '../../data/audit-log.json')

function readLog() {
  return readJSON(logFile, [])
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
  writeJSON(logFile, log)
}

module.exports = { logDeletion }
