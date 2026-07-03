const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const { matchesSearch } = require('../../utils/search')

const logFile = path.join(__dirname, '../../../data/audit-log.json')
function readLog() { return fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [] }

const ENTITY_LABELS = {
  client:      'ผู้รับบริการ',
  counselor:   'นักจิตวิทยา',
  contact:     'คำขอทำนัดหมาย',
  schedule:    'ตารางเวลา',
  appointment: 'นัดหมาย',
  admin:       'ผู้ดูแลระบบ',
}

router.get('/', (req, res) => {
  const { search, entityType } = req.query
  let logs = readLog().sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))

  if (entityType) logs = logs.filter(l => l.entityType === entityType)
  if (search) logs = logs.filter(l => matchesSearch([
    l.entityName,
    l.reason,
    l.actorName,
  ], search))

  res.render('admin/audit-log', {
    page: 'audit-log', title: 'ประวัติการลบข้อมูล',
    logs, query: req.query, entityLabels: ENTITY_LABELS,
  })
})

module.exports = router
