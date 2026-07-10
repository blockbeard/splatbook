import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '$env/dynamic/private';
import * as schema from './schema.ts';

// Local/atlas deployments use better-sqlite3 against a file. The Cloudflare
// deployment (ADAPTER=cloudflare) instead reaches D1 through `platform.env.DB`
// per request, using `drizzle-orm/d1` — better-sqlite3 is a native module and
// can't run in the Workers runtime, so that binding is wired at the request
// layer rather than here (see docs/deployment.md, "Going public on Cloudflare").
// Server-only module — never import from client code ($lib/server enforces this).
const client = new Database(env.DATABASE_URL ?? 'local.db');

export const db = drizzle(client, { schema });
