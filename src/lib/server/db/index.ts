/**
 * The database, resolved **per request**.
 *
 * Two runtimes, one schema:
 *
 * - `ADAPTER=node` (local dev, atlas/Docker) → `better-sqlite3` against a file.
 * - `ADAPTER=cloudflare` (Pages) → D1, reached through `platform.env.DB`.
 *
 * The Workers runtime cannot hold a module-level connection — there is no
 * long-lived process, and `better-sqlite3` is a native module that cannot be
 * bundled into a Worker at all. So the database is resolved from the request's
 * `platform` and handed to consumers on `event.locals.db` (see hooks.server.ts);
 * nothing imports a `db` singleton any more.
 *
 * `better-sqlite3` and its drizzle driver are imported through a non-literal
 * specifier so the bundler cannot see them statically — the same trick
 * `vite.config.ts` uses for the Cloudflare adapter. If it could see them, the
 * Workers build would try to include the native module and fail.
 *
 * Server-only module — never import from client code (`$lib/server` enforces it).
 */

import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import { env } from '$env/dynamic/private';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';

/** The D1 binding declared in `wrangler.toml`, present only on Cloudflare. */
interface D1Platform {
	env?: { DB?: D1Database };
}

/** One connection per node process. */
let nodeDb: Db | undefined;

/**
 * One drizzle client per D1 binding, for the life of the isolate.
 *
 * Building a client is not free: drizzle walks the whole schema to work out
 * its relations (`extractTablesRelationalConfig`) every time. Doing that per
 * request was the largest single cost in a card-table command on Workers (a
 * third of the CPU in workerd, phase 33), paid by every poll as well. The
 * binding is the same object for every request an isolate serves, and the
 * client holds nothing per request, so it is safe to keep. A WeakMap rather
 * than a variable, so a different binding (tests, a second environment) never
 * gets another's client.
 */
const d1Clients = new WeakMap<D1Database, Db>();

async function nodeDatabase(): Promise<Db> {
	if (nodeDb) return nodeDb;

	// Non-literal specifiers: the Workers bundle must not resolve these.
	const betterSqlite = 'better-sqlite3';
	const driver = 'drizzle-orm/better-sqlite3';
	const { default: Database } = (await import(/* @vite-ignore */ betterSqlite)) as {
		default: new (path: string) => unknown;
	};
	const { drizzle } = (await import(/* @vite-ignore */ driver)) as {
		drizzle: (client: unknown, config: { schema: typeof schema }) => Db;
	};

	nodeDb = drizzle(new Database(env.DATABASE_URL ?? 'local.db'), { schema });
	return nodeDb;
}

/**
 * The database for this request: D1 when the platform offers the binding,
 * otherwise the local SQLite file.
 */
export async function getDb(platform?: Readonly<D1Platform>): Promise<Db> {
	const d1 = platform?.env?.DB;
	if (d1) {
		let db = d1Clients.get(d1);
		if (!db) {
			db = drizzleD1(d1, { schema }) as unknown as Db;
			d1Clients.set(d1, db);
		}
		return db;
	}
	return nodeDatabase();
}
