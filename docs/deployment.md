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

Monitoring lives on **Argus** (the house watchdog): Uptime Kuma watches
staging today and production once its check is added — deliberately a third
box, sharing no failure domain with either deployment.

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

## Migrations

Schema lives in `src/lib/server/db/schema.ts`; migrations are generated with
`npm run db:generate` (writing `drizzle/*.sql`) and applied with `npm run db:migrate`
(node/SQLite) or `wrangler d1 migrations apply` (D1). Never hand-edit the generated
SQL — change the schema and regenerate.
