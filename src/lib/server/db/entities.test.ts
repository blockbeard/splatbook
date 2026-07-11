/**
 * Entity service tests. The point of interest is ownership isolation — every
 * function must refuse to touch another user's rows — plus save/load fidelity,
 * list filtering, and the archive/duplicate helpers the dashboard relies on.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import {
	createEntity,
	updateEntity,
	getEntity,
	listEntities,
	setEntityStatus,
	deleteEntity,
	duplicateEntity,
	setEntityCampaign,
	listCampaignEntities,
	type Db
} from './entities.ts';

function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

let db: Db;
let alice: string;
let bob: string;

beforeEach(async () => {
	db = freshDb();
	const [a] = await db.insert(schema.users).values({ email: 'alice@x' }).returning();
	const [b] = await db.insert(schema.users).values({ email: 'bob@x' }).returning();
	alice = a.id;
	bob = b.id;
});

function characterInput(userId: string, name = 'Hero') {
	return {
		userId,
		gameId: 'stonetop',
		entityType: 'character',
		name,
		data: { playbookId: 'the-blessed', note: 'has "quotes"' },
		schemaVersion: 1
	};
}

describe('create / get / update', () => {
	it('saves and loads a blob for its owner', async () => {
		const created = await createEntity(db, characterInput(alice));
		expect(created.status).toBe('draft');
		const loaded = await getEntity(db, created.id, alice);
		expect(loaded?.data).toEqual({ playbookId: 'the-blessed', note: 'has "quotes"' });
	});

	it('updates in place and bumps updatedAt', async () => {
		const created = await createEntity(db, characterInput(alice));
		const updated = await updateEntity(db, created.id, alice, {
			name: 'Renamed',
			status: 'ready'
		});
		expect(updated?.name).toBe('Renamed');
		expect(updated?.status).toBe('ready');
		expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
	});
});

describe('ownership isolation', () => {
	it("hides another user's entity from get", async () => {
		const created = await createEntity(db, characterInput(alice));
		expect(await getEntity(db, created.id, bob)).toBeUndefined();
	});

	it("refuses to update or delete another user's entity", async () => {
		const created = await createEntity(db, characterInput(alice));
		expect(await updateEntity(db, created.id, bob, { name: 'hijack' })).toBeUndefined();
		expect(await deleteEntity(db, created.id, bob)).toBe(false);
		// Alice's row is untouched.
		expect((await getEntity(db, created.id, alice))?.name).toBe('Hero');
	});

	it("won't duplicate another user's entity", async () => {
		const created = await createEntity(db, characterInput(alice));
		expect(await duplicateEntity(db, created.id, bob)).toBeUndefined();
	});
});

describe('listing', () => {
	it('scopes to the owner, newest first, and hides archived by default', async () => {
		const first = await createEntity(db, characterInput(alice, 'First'));
		const second = await createEntity(db, characterInput(alice, 'Second'));
		await createEntity(db, characterInput(bob, "Bob's"));
		await setEntityStatus(db, first.id, alice, 'archived');

		const active = await listEntities(db, alice);
		expect(active.map((e) => e.name)).toEqual(['Second']);

		const all = await listEntities(db, alice, { includeArchived: true });
		expect(all.map((e) => e.id).sort()).toEqual([first.id, second.id].sort());
	});

	it('filters by game and entity type', async () => {
		await createEntity(db, characterInput(alice));
		await createEntity(db, {
			...characterInput(alice, 'Village'),
			entityType: 'steading'
		});
		const chars = await listEntities(db, alice, { gameId: 'stonetop', entityType: 'character' });
		expect(chars).toHaveLength(1);
		expect(chars[0].entityType).toBe('character');
	});
});

describe('duplicate', () => {
	it('clones the blob into a fresh draft named "(copy)"', async () => {
		const created = await createEntity(db, { ...characterInput(alice), status: 'ready' });
		const copy = await duplicateEntity(db, created.id, alice);
		expect(copy?.name).toBe('Hero (copy)');
		expect(copy?.status).toBe('draft');
		expect(copy?.data).toEqual(created.data);
		expect(copy?.id).not.toBe(created.id);
		// A duplicate starts unattached even if the source was in a campaign.
		expect(copy?.campaignId).toBeNull();
	});
});

describe('campaign attachment', () => {
	async function makeCampaign(ownerId: string, gameId = 'stonetop') {
		const [c] = await db.insert(schema.campaigns).values({ gameId, ownerId }).returning();
		return c.id;
	}

	it('attaches and detaches an owned entity, at most one campaign at a time', async () => {
		const first = await makeCampaign(alice);
		const second = await makeCampaign(alice);
		const hero = await createEntity(db, characterInput(alice));

		const attached = await setEntityCampaign(db, hero.id, alice, first);
		expect(attached?.campaignId).toBe(first);

		// Moving replaces rather than accumulates — a single column can't hold two.
		const moved = await setEntityCampaign(db, hero.id, alice, second);
		expect(moved?.campaignId).toBe(second);

		const detached = await setEntityCampaign(db, hero.id, alice, null);
		expect(detached?.campaignId).toBeNull();
	});

	it("won't attach another user's entity", async () => {
		const campaign = await makeCampaign(alice);
		const hero = await createEntity(db, characterInput(alice));
		expect(await setEntityCampaign(db, hero.id, bob, campaign)).toBeUndefined();
		expect((await getEntity(db, hero.id, alice))?.campaignId).toBeNull();
	});

	it('lists every attached entity for a campaign, across owners', async () => {
		const campaign = await makeCampaign(alice);
		const aliceHero = await createEntity(db, characterInput(alice, 'Alice Hero'));
		const bobHero = await createEntity(db, characterInput(bob, 'Bob Hero'));
		const loner = await createEntity(db, characterInput(alice, 'Unattached'));
		await setEntityCampaign(db, aliceHero.id, alice, campaign);
		await setEntityCampaign(db, bobHero.id, bob, campaign);

		const party = await listCampaignEntities(db, campaign, 'character');
		expect(party.map((e) => e.name).sort()).toEqual(['Alice Hero', 'Bob Hero']);
		expect(party.map((e) => e.id)).not.toContain(loner.id);
	});

	it('detaches (set null) rather than deletes when a campaign is removed', async () => {
		const campaign = await makeCampaign(alice);
		const hero = await createEntity(db, characterInput(alice));
		await setEntityCampaign(db, hero.id, alice, campaign);

		await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaign));

		const survivor = await getEntity(db, hero.id, alice);
		expect(survivor).toBeDefined();
		expect(survivor?.campaignId).toBeNull();
	});
});
