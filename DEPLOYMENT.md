# Deployment Guide

This covers what's needed to run MindCare on a real server, beyond the
local Docker setup used for development. No hosting/domain has been chosen
yet as of writing this, so the steps below are what to do once one is —
none of this has been provisioned.

## Before going live — in risk order

### 🔴 Critical — set these up before anything else

1. **Never expose the Mailpit ports to the internet.** `docker-compose.yml`
   maps `8025` (web UI, shows every captured email) and `1025` (SMTP relay)
   for local testing only. If this compose file is used as-is on a public
   server, both ports are reachable by anyone and `1025` can be abused as an
   open relay within hours of being found by a scanner. Remove the `mailpit`
   service (and its port mappings) from the production compose file, or make
   sure your firewall only allows those ports from `localhost`.

2. **Put a real TLS-terminating reverse proxy in front of the app**
   (nginx, Caddy, or your platform's built-in TLS). Without it, login
   credentials, session cookies, and client health data travel in
   cleartext, and any network intermediary can hijack a session by reading
   the cookie off the wire. Needs a real domain — Let's Encrypt (or
   equivalent) can't issue a certificate for a bare IP.

3. **Set `SESSION_SECRET` in the real `.env` on the server** — a strong
   random value (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`),
   not the fallback the app generates itself if it's missing. Never reuse
   the value from local development.

### 🟠 High — set these up alongside the above

4. **Set `DATA_ENCRYPTION_KEY`** the same way as `SESSION_SECRET` (see
   `src/utils/json-store.js`). Without it, `data/*.json` — real client
   PII and mental-health-related notes — sits as plaintext on whatever
   disk the server uses. Existing plaintext files keep working and migrate
   to encrypted automatically the next time each one is written; you don't
   need to convert them by hand.
   - **Losing this key makes every encrypted data file permanently
     unreadable.** Store it somewhere separate from the server itself (a
     password manager, not a text file next to the data).

5. **Once HTTPS is actually in place**, revisit the two things intentionally
   left off in `server.js`'s `helmet()` config:
   - `hsts` — safe to enable once TLS is confirmed working; enabling it
     before that will make browsers try to force HTTPS on a site that
     doesn't have it yet, breaking access.
   - `contentSecurityPolicy` — left off because admin views rely on inline
     `style="..."` / `<script>` throughout (project convention). Enabling a
     real CSP means either refactoring those to a nonce-based policy or
     accepting a much weaker `'unsafe-inline'` policy — treat as a separate,
     larger piece of work, not a quick flag flip.

### 🟡 Medium — needed for the app to actually work as intended in production

6. **Real SMTP credentials.** `docker-compose.yml` currently points at the
   bundled `mailpit` fake SMTP server — appointment confirmations, reminders,
   and satisfaction surveys will never reach a real inbox until this is
   swapped for a real provider (Gmail app password, Office 365, or any SMTP
   service). See `.env`'s `SMTP_*` variables.

7. **`BASE_URL`** in `docker-compose.yml` is hardcoded to
   `http://localhost:3010` — update it to the real `https://` domain once
   one exists. Survey links sent by email are built from this value; left
   as `localhost`, they're unusable to anyone who isn't on the same machine.

8. **Firewall / exposed ports in general.** Only the reverse proxy's ports
   (typically 80/443) should be reachable from the internet. The app's own
   port (3010 locally) should only be reachable by the reverse proxy, not
   directly.

9. **Offsite backups.** `src/utils/backup.js` snapshots `data/` and
   `public/uploads/` into `backups/` on a timer (see `BACKUP_INTERVAL_HOURS`,
   default every 6 hours, `BACKUP_RETENTION_COUNT`, default keeps the last
   28). This is a same-disk safety net against an accidental delete or bad
   edit — it does **not** protect against the disk itself failing, which
   needs a copy somewhere else entirely (rclone to cloud storage, a cron job
   copying `backups/` to another host, etc.). This agent can't set that part
   up without credentials/infra access it doesn't have.

10. **Check `logs/`** periodically (or point it at a log aggregation
    service) — `src/utils/logger.js` writes one file per day
    (`logs/2026-07-15.log`) capturing every unhandled error with full
    request context. These aren't rotated/deleted automatically; decide on
    a retention policy once you know how much log volume the real traffic
    produces.

## Operational notes (already handled, listed for awareness)

- **Graceful shutdown**: the app catches `SIGTERM`/`SIGINT` and finishes
  in-flight requests before exiting (see `server.js`). This only works
  because the `Dockerfile`'s `CMD` runs `node server.js` directly — if that
  ever changes back to `CMD ["npm", "start"]`, signals stop reaching the
  process (npm doesn't forward them) and this silently stops working.
- **Health check**: `GET /health` (also wired into the `Dockerfile`'s
  `HEALTHCHECK`) actually reads a data file rather than just returning 200
  unconditionally, so it catches "process up but disk unreadable" too.
- **Atomic writes**: every `data/*.json` write goes through
  `src/utils/json-store.js`, which writes to a temp file and renames over
  the real one — a crash mid-write can't leave a half-written, corrupted
  file behind.

## JSON-file storage: scaling limits and a future database migration

The app stores everything in `data/*.json`, read and rewritten whole on
every change — there is no indexing, no transactions, and no partial
reads. As of writing, the real dataset is small (84 appointments, 52
clients, ~216KB total) and this is completely fine at that scale.

**Where it starts to matter:**
- Every write re-serializes the *entire* file, so write cost grows with
  total record count, not just the record being changed. A few thousand
  appointments is still fine; tens of thousands would start to show up as
  noticeably slower saves.
- Every list/filter/search operation (`GET /admin/appointments`,
  `/admin/clients`, etc.) loads the whole file into memory and filters in
  JS — no query can be answered without reading everything.
  - Two truly concurrent writers *to the same file* can still lose one
    write to the other (a "last write wins" race) — the atomic-write fix
    above only prevents *corruption*, not this business-logic race. This
    is a low-probability event at current traffic (a small clinic staff,
    not a high-concurrency public API) but not zero.

**A reasonable migration path, if/when the above becomes a real problem**
(not a recommendation to do this now — it's a substantial rewrite):

1. **SQLite** is the smallest step up: still a single file, no separate
   database server to run, but gets real transactions, indexes, and
   concurrent-write safety via the database engine instead of hand-rolled
   file locking. Most of the `readJSON`/`writeJSON` call sites in this
   codebase map fairly directly to `SELECT`/`INSERT`/`UPDATE` calls.
2. **PostgreSQL/Supabase** (the direction hinted at in `skill.md`/`agent.md`)
   is the right choice if the app ever needs multiple server instances
   behind a load balancer — SQLite is still a single file, so it doesn't
   help with that; a real client-server database does.
3. Either way, budget for: an actual schema (currently implicit in
   whatever shape each route happens to read/write), a one-time data
   migration script from the current JSON files, and rewriting every
   `readJSON`/`writeJSON` call site — there are ~20 files' worth (see
   `src/utils/json-store.js`'s callers) — to use the new data layer instead.
   Introducing a thin repository/data-access module first (one file per
   entity: `clients`, `appointments`, etc.) before this migration would
   make swapping the underlying storage a much smaller change than it is
   today, where each route file talks to the JSON files directly.
