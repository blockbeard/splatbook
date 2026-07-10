# Deployment

One repo, three targets, chosen by the `ADAPTER` env var:

| Target                | `ADAPTER`    | Database                  | Use                          |
| --------------------- | ------------ | ------------------------- | ---------------------------- |
| Local dev             | `node`       | `better-sqlite3` file     | your machine                 |
| **atlas + Docker**    | `node`       | `better-sqlite3` on a volume | your table (current v1 path) |
| Cloudflare Pages + D1 | `cloudflare` | D1 (`platform.env.DB`)    | public, when you go wide     |

The near-term production path is **atlas + Docker**. Cloudflare is documented at
the end for when the site goes public; it needs one code change that isn't in the
repo yet (see "Going public on Cloudflare").

## Environment

Copy `.env.example` and fill it in. For any real deployment:

- `AUTH_SECRET` — a real secret (`openssl rand -base64 33`). Required.
- `AUTH_DEV_LOGIN=false` — turn off the zero-click dev login.
- At least one OAuth provider (`AUTH_GOOGLE_ID`/`_SECRET` or `AUTH_DISCORD_ID`/`_SECRET`),
  otherwise no one can sign in once dev-login is off.
- `ORIGIN` — the public URL (e.g. `https://splatbook.app`). SvelteKit form actions
  **403** if this doesn't match the address the browser used.

## atlas + Docker (current v1 path)

The `Dockerfile` (multi-stage, `node:22-bookworm-slim` so better-sqlite3 uses its
prebuilt binary) and `docker-compose.yml` (published earlier) build and run the
node adapter. SQLite lives on the `splatbook-data` volume at `/data/splatbook.db`.

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

## Going public on Cloudflare (Pages + D1)

Cloudflare's serverless runtime can't run `better-sqlite3` (a native module), so
the database is D1, reached per-request through `platform.env.DB`. `wrangler.toml`
already declares the Pages output dir and the `DB` binding.

**One code change is still required** and is deliberately not in the repo, because
it can only be verified against a live D1 instance: the server currently uses a
module-level `better-sqlite3` singleton (`src/lib/server/db/index.ts`), which the
Workers bundle can't include. To go live:

1. Make the database request-scoped. Resolve it from `event.platform.env.DB` with
   `drizzle-orm/d1` and hand it to consumers via `event.locals.db` (set in
   `src/hooks.server.ts`); keep the better-sqlite3 path for `ADAPTER=node` behind
   a lazy/dynamic import so the Workers bundle never pulls in the native module.
   Update the five `import { db } from '$lib/server/db'` call sites
   (`/api/entities*`, `/api/health`, `/dashboard`) and Auth.js (the `DrizzleAdapter`
   must be constructed per request rather than at module load).
2. Add the adapter and a D1 database:
   ```sh
   npm i -D @sveltejs/adapter-cloudflare
   wrangler d1 create splatbook          # paste the id into wrangler.toml
   wrangler d1 migrations apply splatbook # applies drizzle/*.sql
   ```
3. Set production secrets in the Pages project: `AUTH_SECRET`, `AUTH_DEV_LOGIN=false`,
   the OAuth credentials, and `ORIGIN=https://splatbook.app`.
4. Build and deploy:
   ```sh
   ADAPTER=cloudflare npm run build
   wrangler pages deploy .svelte-kit/cloudflare
   ```
5. Point `splatbook.app` at the Pages project (custom domain + TLS are included).

Realtime dice (phase 10) can stay on polling on the free tier; only long-lived
websockets would need Durable Objects (paid).

## Migrations

Schema lives in `src/lib/server/db/schema.ts`; migrations are generated with
`npm run db:generate` (writing `drizzle/*.sql`) and applied with `npm run db:migrate`
(node/SQLite) or `wrangler d1 migrations apply` (D1). Never hand-edit the generated
SQL — change the schema and regenerate.
