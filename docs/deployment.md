# Deployment

One repo, three environments, chosen by the `ADAPTER` env var:

| Environment    | Where                 | `ADAPTER`    | Database                     |
| -------------- | --------------------- | ------------ | ---------------------------- |
| **dev**        | your machine          | `node`       | `better-sqlite3` file        |
| **staging**    | atlas + Docker        | `node`       | `better-sqlite3` on a volume |
| **production** | Cloudflare + D1       | `cloudflare` | D1 (`platform.env.DB`)       |

**Production** is the public site at `splatbook.app`. **Staging** on atlas is
where a build soaks before it ships; its data is disposable by definition —
nothing real lives there (confirmed 2026-07-12). The database is resolved per
request (`event.locals.db`), so the same code serves every environment.

One honesty note about staging: it runs the node adapter on sqlite, so it
proves *features*, not *platform behavior*. Workers/D1-specific failures (the
request-scoped database lesson) only surface in production or under
`wrangler dev` — for adapter-touching changes, check there too.

Monitoring lives on **Argus** (the house watchdog): Uptime Kuma watches both
deployments — deliberately a third box, sharing no failure domain with either.
See [Monitoring (Argus)](#monitoring-argus) below for the checks and the
what-to-do-when-it-pages runbook.

## Environment

Copy `.env.example` and fill it in. For any real deployment:

- `AUTH_SECRET` — a real secret (`openssl rand -base64 33`). Required.
- `AUTH_DEV_LOGIN=false` — turn off the zero-click dev login.
- At least one OAuth provider (`AUTH_GOOGLE_ID`/`_SECRET` or `AUTH_DISCORD_ID`/`_SECRET`),
  otherwise no one can sign in once dev-login is off.
- `ORIGIN` — the public URL (e.g. `https://splatbook.app`). SvelteKit form actions
  **403** if this doesn't match the address the browser used.

## atlas + Docker (staging)

The `Dockerfile` (multi-stage, `node:22-bookworm-slim` so better-sqlite3 uses its
prebuilt binary) and `docker-compose.yml` (published earlier) build and run the
node adapter. SQLite lives on the `splatbook-data` volume at `/data/splatbook.db`.

### Routine deploy (the usual loop)

From the checkout on atlas (node 22 via nvm is installed there for the
migration step — matches the Dockerfile):

```sh
git pull --ff-only
docker compose up -d --build
DATABASE_URL=/var/lib/docker/volumes/splatbook_splatbook-data/_data/splatbook.db \
  npm run db:migrate          # idempotent — safe to run every deploy
curl -f http://localhost:3000/api/health
```

(`npm ci` first if dependencies changed. `docker volume inspect
splatbook_splatbook-data` confirms the volume path if it differs.)

### Browsing staging from another machine

Staging's `ORIGIN` is `http://localhost:3000` **on purpose**, which has two
consequences that look like bugs if you've forgotten this section:

- `http://atlas:3000` / the LAN IP won't work as a way in — even where the
  port is reachable, any form post (sign-in included) 403s because the
  browser's address doesn't match `ORIGIN`.
- The supported path from another machine is an SSH tunnel, which makes your
  browser's address *be* the ORIGIN:

  ```sh
  ssh -L 3000:localhost:3000 atlas
  # then browse http://localhost:3000
  ```

To expose staging directly on the LAN instead, change `ORIGIN` in atlas's
`.env` to the address you'll browse (compose already publishes `3000:3000` on
all interfaces; if the port doesn't even connect, it's the box's firewall,
not the compose file) — but the tunnel keeps staging private with zero
configuration, which is why it's the default.

### Multi-device testing over the tailnet

For testing from phones and other browsers at once, the tunnel doesn't scale —
but don't just point `ORIGIN` at `http://atlas:3000`: Google refuses plain-http
redirect URIs for non-localhost addresses (OAuth sign-in dies), and
non-localhost http isn't a secure context, so `navigator.clipboard` (the
invite-copy button) fails in ways that look like app bugs. **Tailscale Serve**
gives staging a real HTTPS name every tailnet device can reach:

```sh
# on atlas (needs MagicDNS + HTTPS certificates enabled in the tailnet admin)
sudo tailscale serve --bg --https=443 http://localhost:3000
tailscale serve status          # → https://atlas.<tailnet>.ts.net
```

Then in atlas's `.env`: `ORIGIN=https://atlas.<tailnet>.ts.net`, restart the
container (`docker compose up -d`), and add
`https://atlas.<tailnet>.ts.net/auth/callback/google` (and `…/discord`) to the
OAuth app's redirect URIs. `ORIGIN` is one value: while it points at the
tailnet name, the localhost tunnel 403s on form posts — switch back when the
testing session is over, or leave it if the tailnet is how you always browse.
Serve is tailnet-only (not funnel): staging stays private, and being HTTPS it
matches production's secure-context behaviour, which the tunnel never did.

1. **Configure.** Put a `.env` next to `docker-compose.yml` on atlas with at least
   `ORIGIN`, `AUTH_SECRET`, `AUTH_DEV_LOGIN=false`, and your OAuth credentials.
   Compose already reads `ORIGIN`; add the rest to the `environment:` block or an
   `env_file:` entry.

2. **Build and start.**

   ```sh
   docker compose up -d --build
   ```

3. **Apply the database schema (first run, and after any schema change).** The
   runtime image is pruned to production dependencies, so `drizzle-kit` isn't in
   the container. Apply the migrations from a dev checkout on atlas, pointed at
   the volume's database file:

   ```sh
   DATABASE_URL=/var/lib/docker/volumes/splatbook_splatbook-data/_data/splatbook.db \
     npm run db:migrate
   ```

   (Adjust the volume path to your Docker root; `docker volume inspect
   splatbook_splatbook-data` prints it. Alternatively bind-mount a host directory
   for `/data` so the path is stable.) The migrations are the committed
   `drizzle/*.sql`.

4. **Verify.** `curl -f http://localhost:3000/api/health` (the compose healthcheck
   hits the same endpoint). Then browse via your `ORIGIN`.

### Exposing it

For remote players without opening a home port, front it with a **Cloudflare
Tunnel** (`cloudflared`) — no inbound ports, your home IP stays hidden, and
Cloudflare caches the static assets. This keeps the table-only deployment private
and simple; uptime is your box's uptime.

## Cloudflare Pages + D1 (the public site)

Cloudflare's runtime can't run `better-sqlite3` (a native module) and has no
long-lived process to hold a connection, so the database is **D1, resolved per
request** from `platform.env.DB` (`src/lib/server/db/index.ts` → `locals.db`).
That code is in the repo and verified; nothing further is needed to go live.

Two settings are load-bearing and were learned the hard way:

- `compatibility_flags = ["nodejs_compat"]` in `wrangler.toml`. Auth.js reaches
  for node builtins; without the flag the build succeeds and **sign-in throws at
  runtime**.
- `better-sqlite3` is imported through a non-literal specifier so the bundler
  cannot see it statically. Make it a literal and the Workers build tries to
  include the native module and fails.

### Go live

```sh
wrangler login
wrangler d1 create splatbook              # paste the id into wrangler.toml
wrangler d1 migrations apply splatbook --remote
ADAPTER=cloudflare npm run build
wrangler pages deploy .svelte-kit/cloudflare --project-name splatbook
```

Then, in the Pages project (dashboard or `wrangler pages secret put`):

- `AUTH_SECRET` — `openssl rand -base64 33`
- `AUTH_DEV_LOGIN=false` — **essential**: dev-login is a passwordless "sign in as
  anyone" door. It is on by default because local work needs it.
- `ORIGIN=https://splatbook.app` — SvelteKit form actions **403** if this doesn't
  match the address the browser used.
- OAuth credentials for at least one provider, or nobody can sign in.

Bind the D1 database to the Pages project (`DB`), add `splatbook.app` as a custom
domain (TLS included), and add the callback URLs at each OAuth provider:
`https://splatbook.app/auth/callback/google`, `…/discord`. A Google consent screen
left in **Testing** mode only admits accounts listed as test users — publish it, or
expect players to bounce.

### Preview it locally, on the real runtime

Worth doing before any deploy — the node dev server will not show you a Workers
problem:

```sh
wrangler d1 migrations apply splatbook --local
ADAPTER=cloudflare npm run build
AUTH_SECRET=dev AUTH_DEV_LOGIN=true wrangler pages dev .svelte-kit/cloudflare
```

Realtime dice (phase 10) stay on polling on the free tier; only long-lived
websockets would need Durable Objects (paid).

## Monitoring (Argus)

Argus is the house watchdog — a dedicated box running **Uptime Kuma**,
deliberately sharing no failure domain with either deployment: if atlas dies it
still pages, if Cloudflare has a bad day it still pages, and if *Argus* dies
nothing else goes with it. (A watcher on atlas watching atlas would sleep
through exactly the outages that matter.)

### The checks (commit 117)

| Monitor              | Type       | Target                                | Interval | Alert after |
| -------------------- | ---------- | ------------------------------------- | -------- | ----------- |
| `splatbook-staging`  | HTTP(s)    | atlas's `/api/health` (LAN address)   | 60 s     | 3 retries   |
| `splatbook-prod`     | HTTP(s)    | `https://splatbook.app/api/health`    | 60 s     | 3 retries   |
| `splatbook-d1-export`| Push       | pinged by the nightly export (below)  | 24 h + grace | 1 miss  |

Both HTTP checks assert **status 200** *and* the keyword `"db": "ok"` — the
health endpoint does a real database round-trip and answers 503/`degraded`
when the DB is unreachable, so a keyword check catches the half-alive state
where the process serves but the data is gone. Set "Accepted Status Codes" to
`200` only (Kuma's default `200-299` is fine too; the keyword is the real
gate).

**Confirm notifications actually arrive** when adding the production check:
Kuma → the monitor → Notifications → send a test, then pause the monitor for
two minutes and watch the alert land. An unconfirmed notification channel is
the monitoring equivalent of an untested backup.

### When it pages (production)

1. **Confirm it's real.** Open `https://splatbook.app/api/health` yourself.
   Kuma's check runs from the house — a home-ISP blip pages too. If it loads
   fine, check Argus's own network before anything else.
2. **Read the body.** `{"status":"degraded","db":"unreachable"}` with a 503 is
   a D1 problem, not a deploy problem — check
   [Cloudflare's status page](https://www.cloudflarestatus.com/) and the D1
   dashboard. A connection error or Cloudflare error page (52x) is the
   platform or the Pages project itself.
3. **Check the last deploy.** Pages dashboard → deployments. If the timing
   matches a deploy, roll back to the previous deployment from the dashboard
   (one click) — investigate on staging, not in production.
4. **If Cloudflare is healthy and rollback doesn't fix it**, check the Pages
   project's environment variables/secrets (`ORIGIN`, `AUTH_SECRET`, D1
   binding) — a vanished binding presents exactly like a dead database.
5. **Data looks wrong or lost?** Stop and go to the restore rehearsal under
   [Nightly D1 export](#nightly-d1-export-to-atlas) — don't experiment against
   the live database; work out what happened against last night's dump first.

### When it pages (staging)

Staging is disposable by definition. Fix it with the routine-deploy loop above
(most staging pages are "the container didn't come back after a reboot":
`docker compose up -d`). Nothing real is at risk; take the time to understand
the failure instead.

## Nightly D1 export to atlas

Production's database is D1 — Cloudflare's copy is the only copy until
something else holds one. A cron on atlas (commit 118) runs
[`ops/d1-export.sh`](../ops/d1-export.sh) nightly: `wrangler d1 export
--remote` against **production**, into a dated, compressed dump under a
directory the existing 3-2-1 backup already sweeps — from there the offsite
copies come for free.

### Setup (once, on atlas)

1. **A narrow API token.** Cloudflare dashboard → API tokens → create one
   scoped to **D1 read only** for this account. A backup job holds the
   narrowest key that can do its job — this token can exfiltrate the database
   (that's its purpose) but can't touch it.
2. **An environment file** the cron sources, mode 600, e.g.
   `/etc/splatbook-backup.env`:

   ```sh
   export CLOUDFLARE_API_TOKEN=…      # the D1-read token
   export CLOUDFLARE_ACCOUNT_ID=…
   export KUMA_PUSH_URL=…             # the splatbook-d1-export push monitor
   # optional overrides: BACKUP_ROOT, KEEP_DAILY, KEEP_MONTHLY
   ```

3. **The cron line** (any pre-dawn minute; 03:15 avoids the top-of-hour herd):

   ```cron
   15 3 * * *  . /etc/splatbook-backup.env && /opt/splatbook/ops/d1-export.sh
   ```

4. **The push monitor.** Uptime Kuma on Argus → new monitor, type **Push**,
   heartbeat 24 h with an hour's grace; put its URL in `KUMA_PUSH_URL`. The
   script pings it *after* the dump is written, verified and rotated — so the
   alert fires on the night nothing pinged. Silent cron death is the actual
   failure mode of home-grown backups; this is the tripwire.

Retention is handled by the script: 14 daily dumps, 12 monthlies (the first
dump of each month is set aside before pruning). The 3-2-1 sweep of
`/mnt/storage/backups` carries copies offsite unchanged.

### Restore rehearsal (do this once now, and after anything structural)

An untested backup is a hope, not a backup. The dump is plain SQL, so the
rehearsal runs anywhere with a checkout — no Cloudflare involved:

```sh
gunzip -k splatbook-2026-07-17.sql.gz
sqlite3 rehearsal.db < splatbook-2026-07-17.sql
sqlite3 rehearsal.db "select count(*) from entities; select count(*) from users;"
```

Counts looking right is necessary, not sufficient — open a character through
the real code path:

```sh
DATABASE_URL=rehearsal.db AUTH_DEV_LOGIN=true npm run dev
# sign in via dev-login, open the dashboard, open a character sheet
```

If a sheet renders from last night's dump, the backup restores. Note the date
you last did this at the top of the backup directory (`touch
REHEARSED-2026-07-17` is enough); if it's been months, do it again.

Restoring *production* from a dump is the same idea aimed the other way:
`wrangler d1 execute splatbook --remote --file dump.sql` into a **fresh** D1
database, then rebind the Pages project — never execute a restore over the
live database while it still holds the only copy of anything.

## Migrations

Schema lives in `src/lib/server/db/schema.ts`; migrations are generated with
`npm run db:generate` (writing `drizzle/*.sql`) and applied with `npm run db:migrate`
(node/SQLite) or `wrangler d1 migrations apply` (D1). Never hand-edit the generated
SQL — change the schema and regenerate.
