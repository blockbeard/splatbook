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

describe('campaigns + membership schema', () => {
	it('creates a campaign with a generated id and invite token, and defaults', async () => {
		const db = freshDb();
		const owner = await seedUser(db);
		const [campaign] = await db
			.insert(schema.campaigns)
			.values({ gameId: 'stonetop', name: 'Ringwall', ownerId: owner.id })
			.returning();

		expect(campaign.id).toMatch(/[0-9a-f-]{36}/);
		expect(campaign.inviteToken).toMatch(/[0-9a-f-]{36}/);
		expect(campaign.name).toBe('Ringwall');
		expect(campaign.createdAt).toBeInstanceOf(Date);
	});

	it('enforces one membership row per (campaign, user)', async () => {
		const db = freshDb();
		const owner = await seedUser(db);
		const [campaign] = await db
			.insert(schema.campaigns)
			.values({ gameId: 'stonetop', ownerId: owner.id })
			.returning();

		await db
			.insert(schema.campaignMembers)
			.values({ campaignId: campaign.id, userId: owner.id, role: 'gm' });

		// A second seat for the same user in the same campaign violates the PK.
		await expect(
			db
				.insert(schema.campaignMembers)
				.values({ campaignId: campaign.id, userId: owner.id, role: 'player' })
		).rejects.toThrow();
	});

	it('rejects a duplicate invite token (unique constraint)', async () => {
		const db = freshDb();
		const owner = await seedUser(db);
		await db
			.insert(schema.campaigns)
			.values({ gameId: 'stonetop', ownerId: owner.id, inviteToken: 'shared' });
		await expect(
			db
				.insert(schema.campaigns)
				.values({ gameId: 'stonetop', ownerId: owner.id, inviteToken: 'shared' })
		).rejects.toThrow();
	});

	it('cascades campaign + memberships when the owner is deleted', async () => {
		const db = freshDb();
		const owner = await seedUser(db);
		const [campaign] = await db
			.insert(schema.campaigns)
			.values({ gameId: 'stonetop', ownerId: owner.id })
			.returning();
		await db
			.insert(schema.campaignMembers)
			.values({ campaignId: campaign.id, userId: owner.id, role: 'gm' });

		await db.delete(schema.users).where(eq(schema.users.id, owner.id));

		expect(await db.select().from(schema.campaigns)).toHaveLength(0);
		expect(await db.select().from(schema.campaignMembers)).toHaveLength(0);
	});

	it('cascades memberships when a member (not owner) leaves via account deletion', async () => {
		const db = freshDb();
		const owner = await seedUser(db);
		const [player] = await db
			.insert(schema.users)
			.values({ email: 'player@ringwall.example' })
			.returning();
		const [campaign] = await db
			.insert(schema.campaigns)
			.values({ gameId: 'stonetop', ownerId: owner.id })
			.returning();
		await db.insert(schema.campaignMembers).values([
			{ campaignId: campaign.id, userId: owner.id, role: 'gm' },
			{ campaignId: campaign.id, userId: player.id, role: 'player' }
		]);

		await db.delete(schema.users).where(eq(schema.users.id, player.id));

		// The campaign and the GM seat survive; only the player's seat is gone.
		expect(await db.select().from(schema.campaigns)).toHaveLength(1);
		const remaining = await db.select().from(schema.campaignMembers);
		expect(remaining.map((m) => m.userId)).toEqual([owner.id]);
	});
});
