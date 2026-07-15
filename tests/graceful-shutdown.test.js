const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

// Behavioral end-to-end verification (real SIGTERM sent to the actual Linux
// Docker container via `docker stop`, confirming exit code 0 and the
// expected log lines) was done manually rather than here: Windows does not
// support delivering signals to a spawned child process the way POSIX does
// (Node's own documented limitation — child.kill('SIGTERM'/'SIGINT') on
// Windows either force-terminates immediately or is unreliable depending on
// how the child was spawned), so a spawn-and-signal test cannot run
// deterministically on this dev machine. This test instead statically
// verifies the shutdown wiring is present and wired to both signals, so a
// future edit can't silently drop it.
test('server.js registers a graceful shutdown handler for both SIGTERM and SIGINT', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8')

  assert.match(source, /process\.on\(['"]SIGTERM['"],\s*\(\)\s*=>\s*shutdown\(['"]SIGTERM['"]\)\)/,
    'SIGTERM should be wired to the shutdown() function')
  assert.match(source, /process\.on\(['"]SIGINT['"],\s*\(\)\s*=>\s*shutdown\(['"]SIGINT['"]\)\)/,
    'SIGINT should be wired to the shutdown() function')
  assert.match(source, /server\.close\(/, 'shutdown() should call server.close() to stop accepting new connections and let in-flight requests finish')
  assert.match(source, /clearInterval\(reminderInterval\)/, 'shutdown() should stop the reminder polling interval so it cannot start new work while closing')
})

test('the Dockerfile runs node directly (not `npm start`), so node is PID 1 and actually receives SIGTERM', () => {
  // npm does not forward signals to the child process it spawns for `npm
  // start` — Docker (or `docker compose down`) sending SIGTERM to PID 1 would
  // kill npm without ever reaching server.js's shutdown handler above. This
  // was caught by testing against the real container: docker stop showed
  // "npm error signal SIGTERM" and an abrupt exit until the CMD was changed.
  const dockerfile = fs.readFileSync(path.join(__dirname, '..', 'Dockerfile'), 'utf8')
  assert.match(dockerfile, /CMD\s*\[\s*"node"\s*,\s*"server\.js"\s*\]/)
  assert.doesNotMatch(dockerfile, /CMD\s*\[\s*"npm"/)
})
