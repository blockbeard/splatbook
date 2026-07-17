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
	updateCampaignEntityData,
	getCampaignSteadingForEditor,
	updateCampaignSteadingData,
	type Db
} from './entities.ts';
import { createCampaign, joinCampaign, setSteadingEditor } from './campaigns.ts';

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

describe('updateCampaignEntityData', () => {
	/** Alice GMs a campaign; Bob plays, with his character attached to it. */
	async function table() {
		const campaign = await createCampaign(db, {
			gameId: 'stonetop',
			name: 'Ringwall',
			ownerId: alice
		});
		await joinCampaign(db, campaign.inviteToken, bob);
		const bobsCharacter = await createEntity(db, {
			userId: bob,
			gameId: 'stonetop',
			entityType: 'character',
			name: 'Ryn',
			schemaVersion: 1,
			data: { xp: 2 }
		});
		await setEntityCampaign(db, bobsCharacter.id, bob, campaign.id);
		return { campaign, bobsCharacter };
	}

	// The reason this path exists: at end of session the GM awards XP to the whole
	// party, and the party's characters belong to the players.
	it('lets the GM write a player’s character attached to their campaign', async () => {
		const { bobsCharacter } = await table();

		const updated = await updateCampaignEntityData(db, bobsCharacter.id, alice, { xp: 5 });
		expect(updated?.data).toEqual({ xp: 5 });
		// Bob still owns it.
		expect(updated?.userId).toBe(bob);
	});

	it('refuses a player writing another player’s character', async () => {
		const { campaign } = await table();
		const alicesCharacter = await createEntity(db, {
			userId: alice,
			gameId: 'stonetop',
			entityType: 'character',
			name: 'Vera',
			schemaVersion: 1,
			data: { xp: 0 }
		});
		await setEntityCampaign(db, alicesCharacter.id, alice, campaign.id);

		// Bob is a player, not the GM — even at the same table.
		expect(await updateCampaignEntityData(db, alicesCharacter.id, bob, { xp: 99 })).toBeUndefined();
		const [row] = await db
			.select()
			.from(schema.entities)
			.where(eq(schema.entities.id, alicesCharacter.id));
		expect(row.data).toEqual({ xp: 0 });
	});

	it('refuses an entity that is attached to no campaign', async () => {
		const loose = await createEntity(db, {
			userId: bob,
			gameId: 'stonetop',
			entityType: 'character',
			name: 'Loose',
			schemaVersion: 1,
			data: { xp: 1 }
		});
		expect(await updateCampaignEntityData(db, loose.id, alice, { xp: 9 })).toBeUndefined();
	});

	it('refuses a GM of some other campaign', async () => {
		const { bobsCharacter } = await table();
		const [carol] = await db.insert(schema.users).values({ email: 'carol@x' }).returning();
		await createCampaign(db, { gameId: 'stonetop', name: 'Elsewhere', ownerId: carol.id });

		expect(
			await updateCampaignEntityData(db, bobsCharacter.id, carol.id, { xp: 9 })
		).toBeUndefined();
	});
});

describe('campaign steading delegation (phase 16)', () => {
	/** Alice GMs a campaign with a steading she owns; Bob plays. */
	async function table() {
		const campaign = await createCampaign(db, {
			gameId: 'stonetop',
			name: 'Ringwall',
			ownerId: alice
		});
		await joinCampaign(db, campaign.inviteToken, bob);
		const steading = await createEntity(db, {
			userId: alice,
			gameId: 'stonetop',
			entityType: 'steading',
			name: 'Stonetop',
			schemaVersion: 1,
			data: { prosperity: 'steady' }
		});
		await setEntityCampaign(db, steading.id, alice, campaign.id);
		return { campaign, steading };
	}

	it('lets the GM read and write the steading she owns', async () => {
		const { steading } = await table();
		expect((await getCampaignSteadingForEditor(db, steading.id, alice))?.id).toBe(steading.id);
		const updated = await updateCampaignSteadingData(db, steading.id, alice, {
			prosperity: 'rich'
		});
		expect(updated?.data).toEqual({ prosperity: 'rich' });
		// Still Alice's entity.
		expect(updated?.userId).toBe(alice);
	});

	it('refuses a player without the grant', async () => {
		const { steading } = await table();
		expect(await getCampaignSteadingForEditor(db, steading.id, bob)).toBeUndefined();
		expect(
			await updateCampaignSteadingData(db, steading.id, bob, { prosperity: 'poor' })
		).toBeUndefined();
		const [row] = await db
			.select()
			.from(schema.entities)
			.where(eq(schema.entities.id, steading.id));
		expect(row.data).toEqual({ prosperity: 'steady' });
	});

	it('lets a granted player read and write, and stops honouring it once revoked', async () => {
		const { campaign, steading } = await table();
		await setSteadingEditor(db, campaign.id, alice, bob, true);

		expect((await getCampaignSteadingForEditor(db, steading.id, bob))?.id).toBe(steading.id);
		const updated = await updateCampaignSteadingData(db, steading.id, bob, { prosperity: 'rich' });
		expect(updated?.data).toEqual({ prosperity: 'rich' });
		// Ownership is untouched — Bob edits Alice's steading, he doesn't take it.
		expect(updated?.userId).toBe(alice);

		await setSteadingEditor(db, campaign.id, alice, bob, false);
		expect(await getCampaignSteadingForEditor(db, steading.id, bob)).toBeUndefined();
		expect(
			await updateCampaignSteadingData(db, steading.id, bob, { prosperity: 'poor' })
		).toBeUndefined();
	});

	it('refuses a non-member even with the flag set elsewhere', async () => {
		const { steading } = await table();
		const [carol] = await db.insert(schema.users).values({ email: 'carol@x' }).returning();
		expect(await getCampaignSteadingForEditor(db, steading.id, carol.id)).toBeUndefined();
		expect(await updateCampaignSteadingData(db, steading.id, carol.id, { x: 1 })).toBeUndefined();
	});

	it('refuses a steading attached to no campaign', async () => {
		const loose = await createEntity(db, {
			userId: alice,
			gameId: 'stonetop',
			entityType: 'steading',
			name: 'Loose',
			schemaVersion: 1,
			data: {}
		});
		// Even the owner goes through the normal owner path for a loose steading;
		// this delegated path only ever touches a campaign's shared one.
		expect(await getCampaignSteadingForEditor(db, loose.id, alice)).toBeUndefined();
	});

	it('refuses a non-steading entity even for its campaign GM', async () => {
		const { campaign } = await table();
		const bobsCharacter = await createEntity(db, {
			userId: bob,
			gameId: 'stonetop',
			entityType: 'character',
			name: 'Ryn',
			schemaVersion: 1,
			data: { xp: 0 }
		});
		await setEntityCampaign(db, bobsCharacter.id, bob, campaign.id);
		// The steading path is for steadings only; characters use their own path.
		expect(
			await updateCampaignSteadingData(db, bobsCharacter.id, alice, { xp: 9 })
		).toBeUndefined();
	});
});
