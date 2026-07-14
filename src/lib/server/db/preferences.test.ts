/**
 * Preference service tests. Points of interest: `setPreference` both creates
 * and overwrites (the composite-key upsert), `getPreferences` returns a flat
 * map scoped to one user, `clearPreference` removes a key without touching
 * others, and deleting the user cascades their preferences away.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';
import { getPreferences, setPreference, clearPreference } from './preferences.ts';

function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

let db: Db;
let userId: string;

beforeEach(async () => {
	db = freshDb();
	const [user] = await db.insert(schema.users).values({ email: 'reader@x' }).returning();
	userId = user.id;
});

describe('setPreference / getPreferences', () => {
	it('creates a preference and reads it back in the user’s map', async () => {
		await setPreference(db, userId, 'reference.showSetting', 'true');
		expect(await getPreferences(db, userId)).toEqual({ 'reference.showSetting': 'true' });
	});

	it('overwrites an existing key rather than duplicating the row', async () => {
		await setPreference(db, userId, 'reference.showSetting', 'true');
		await setPreference(db, userId, 'reference.showSetting', 'false');
		expect(await getPreferences(db, userId)).toEqual({ 'reference.showSetting': 'false' });

		const rows = await db
			.select()
			.from(schema.preferences)
			.where(eq(schema.preferences.userId, userId));
		expect(rows).toHaveLength(1);
	});

	it('scopes the map to one user', async () => {
		const [other] = await db.insert(schema.users).values({ email: 'other@x' }).returning();
		await setPreference(db, userId, 'reference.showSetting', 'true');
		await setPreference(db, other.id, 'reference.showSetting', 'false');
		expect(await getPreferences(db, userId)).toEqual({ 'reference.showSetting': 'true' });
	});

	it('returns an empty map for a user with no preferences set', async () => {
		expect(await getPreferences(db, userId)).toEqual({});
	});
});

describe('clearPreference', () => {
	it('removes one key, leaving others intact', async () => {
		await setPreference(db, userId, 'reference.showSetting', 'true');
		await setPreference(db, userId, 'other.pref', 'x');
		await clearPreference(db, userId, 'reference.showSetting');
		expect(await getPreferences(db, userId)).toEqual({ 'other.pref': 'x' });
	});

	it('is a no-op for a key that was never set', async () => {
		await expect(clearPreference(db, userId, 'nope')).resolves.toBeUndefined();
	});
});

describe('cascade', () => {
	it('drops a user’s preferences when the account is deleted', async () => {
		await setPreference(db, userId, 'reference.showSetting', 'true');
		await db.delete(schema.users).where(eq(schema.users.id, userId));
		const rows = await db
			.select()
			.from(schema.preferences)
			.where(eq(schema.preferences.userId, userId));
		expect(rows).toHaveLength(0);
	});
});
