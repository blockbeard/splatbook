/**
 * Schema round-trip tests. These exercise the real migration (`drizzle/`) against
 * an in-memory SQLite database, so they double as a check that `db:generate`
 * output is applyable and that the generic blob model behaves:
 *  - a JSON `data` blob survives a write/read cycle intact,
 *  - defaults (`status`, `schemaVersion`, timestamps) populate,
 *  - deleting a user cascades to their entities.
 */

import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';

function freshDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

async function seedUser(db: ReturnType<typeof freshDb>) {
	const [user] = await db
		.insert(schema.users)
		.values({ email: 'wray@ringwall.example', name: 'Mr. Wray' })
		.returning();
	return user;
}

describe('users + entities schema', () => {
	it('applies the generated migration and inserts a user with a generated id', async () => {
		const db = freshDb();
		const user = await seedUser(db);
		expect(user.id).toMatch(/[0-9a-f-]{36}/);
		expect(user.email).toBe('wray@ringwall.example');
	});

	it('round-trips a JSON data blob through the entity row', async () => {
		const db = freshDb();
		const user = await seedUser(db);
		const blob = {
			playbookId: 'the-blessed',
			stats: { WIS: 2, CHA: 1 },
			moves: ['spirit-tongue', 'call-the-spirits'],
			note: 'quotes "inside" the string'
		};

		const [row] = await db
			.insert(schema.entities)
			.values({
				userId: user.id,
				gameId: 'stonetop',
				entityType: 'character',
				name: 'The Blessed',
				data: blob
			})
			.returning();

		expect(row.data).toEqual(blob);
		// Defaults populate.
		expect(row.status).toBe('draft');
		expect(row.schemaVersion).toBe(1);
		expect(row.createdAt).toBeInstanceOf(Date);
		expect(row.updatedAt).toBeInstanceOf(Date);

		// And it reads back the same on a fresh select.
		const fetched = await db.query.entities.findFirst({ where: eq(schema.entities.id, row.id) });
		expect(fetched?.data).toEqual(blob);
	});

	it('cascades entity deletes when the owning user is removed', async () => {
		const db = freshDb();
		const user = await seedUser(db);
		await db.insert(schema.entities).values({
			userId: user.id,
			gameId: 'stonetop',
			entityType: 'character',
			name: 'Doomed',
			data: {}
		});

		await db.delete(schema.users).where(eq(schema.users.id, user.id));
		const orphans = await db.select().from(schema.entities);
		expect(orphans).toHaveLength(0);
	});

	it('rejects an entity with no owner (FK enforced)', async () => {
		const db = freshDb();
		await expect(
			db.insert(schema.entities).values({
				userId: 'nobody',
				gameId: 'stonetop',
				entityType: 'character',
				data: {}
			})
		).rejects.toThrow();
	});
});
