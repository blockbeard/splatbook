/**
 * Create a fresh, migrated SQLite database for the smoke run so each CI/local
 * run starts clean. Runs inside the Playwright `webServer.command` chain
 * (after the build, before the server boots) rather than as `globalSetup`:
 * Playwright starts the web server during plugin setup, which happens *before*
 * globalSetup, so a globalSetup reset would delete the very file the already-
 * running server holds open. The filename matches the `DATABASE_URL` the web
 * server is launched with in `playwright.config.ts`.
 */

import { existsSync, rmSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const E2E_DB = 'e2e-test.db';

for (const f of [E2E_DB, `${E2E_DB}-shm`, `${E2E_DB}-wal`]) {
	if (existsSync(f)) rmSync(f);
}
const db = drizzle(new Database(E2E_DB));
migrate(db, { migrationsFolder: './drizzle' });
