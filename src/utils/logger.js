const fs = require('fs')
const path = require('path')

const defaultLogsDir = path.join(__dirname, '../../logs')

// One file per UTC day (logs/2026-07-15.log) — simple, no external rotation
// dependency needed, and old files can just be deleted/archived by date.
function logFilePath(dir, date) {
  return path.join(dir, `${date.toISOString().split('T')[0]}.log`)
}

// `dir` lets tests point at a throwaway directory instead of the real
// logs/ folder; every exported function defaults to the real one.
function writeLine(level, message, extra, dir = defaultLogsDir) {
  const entry = { time: new Date().toISOString(), level, message, ...(extra ? extra : {}) }
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(logFilePath(dir, new Date()), JSON.stringify(entry) + '\n')
  } catch (err) {
    // Logging must never be why a request fails — if the file write itself
    // fails (disk full, permissions), fall back to console only.
    console.error('[Logger] Failed to write log file:', err.message)
  }
}

// Every logError call still prints to console too (so `docker logs` and
// local dev output work exactly as before) — the file write is additive,
// giving a persistent record that survives a container restart, which
// console-only output does not unless something external captures it.
function logError(message, err, dir) {
  console.error(`[Error] ${message}`, err ? err.message : '')
  writeLine('error', message, err ? { errorMessage: err.message, stack: err.stack } : undefined, dir)
}

function logWarn(message, dir) {
  console.warn(`[Warn] ${message}`)
  writeLine('warn', message, undefined, dir)
}

function logInfo(message, dir) {
  console.log(`[Info] ${message}`)
  writeLine('info', message, undefined, dir)
}

module.exports = { logError, logWarn, logInfo, logsDir: defaultLogsDir }
