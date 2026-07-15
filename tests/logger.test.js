const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { logError, logWarn, logInfo } = require('../src/utils/logger')

function tempLogsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mindcare-logger-test-'))
}

function readTodayLines(dir) {
  const today = new Date().toISOString().split('T')[0]
  const logFile = path.join(dir, `${today}.log`)
  return fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l))
}

test('logError appends a JSON line with the message, error message, and stack', () => {
  const dir = tempLogsDir()
  try {
    logError('test context message', new Error('boom'), dir)
    const lines = readTodayLines(dir)
    assert.equal(lines.length, 1)
    assert.equal(lines[0].level, 'error')
    assert.equal(lines[0].message, 'test context message')
    assert.equal(lines[0].errorMessage, 'boom')
    assert.match(lines[0].stack, /Error: boom/)
    assert.match(lines[0].time, /^\d{4}-\d{2}-\d{2}T/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('logWarn and logInfo write their own level, appending to the same file across calls', () => {
  const dir = tempLogsDir()
  try {
    logWarn('a warning happened', dir)
    logInfo('just fyi', dir)
    const lines = readTodayLines(dir)
    assert.equal(lines.length, 2)
    assert.ok(lines.some(l => l.level === 'warn' && l.message === 'a warning happened'))
    assert.ok(lines.some(l => l.level === 'info' && l.message === 'just fyi'))
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('logError does not throw even when the log file path is blocked by a name collision', () => {
  const parent = tempLogsDir()
  const dir = path.join(parent, 'logs')
  const today = new Date().toISOString().split('T')[0]
  // Create the log "file" path as a directory first, so the real write
  // (fs.appendFileSync) fails with EISDIR — confirms the failure is caught
  // and swallowed (console-only fallback) instead of throwing and taking
  // the caller's request down with it.
  fs.mkdirSync(path.join(dir, `${today}.log`), { recursive: true })
  try {
    assert.doesNotThrow(() => logError('should not throw', new Error('irrelevant'), dir))
  } finally {
    fs.rmSync(parent, { recursive: true, force: true })
  }
})

test('logsDir defaults to <project root>/logs when no override is given', () => {
  const { logsDir } = require('../src/utils/logger')
  assert.equal(path.basename(logsDir), 'logs')
  assert.equal(path.dirname(logsDir), path.join(__dirname, '..'))
})
