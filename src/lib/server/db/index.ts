import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { env } from '$env/dynamic/private';
import * as schema from './schema.ts';

// Local/atlas deployments use better-sqlite3 against a file; the Cloudflare D1
// driver arrives with the phase-8 adapter switch. Server-only module — never
// import from client code ($lib/server enforces this).
const client = new Database(env.DATABASE_URL ?? 'local.db');

export const db = drizzle(client, { schema });
