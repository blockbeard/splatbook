/**
 * Campaign service tests. The points of interest are: creating a campaign seats
 * its owner as GM; the invite token is a working lookup key; membership drives
 * listings; and rotating the token is owner-guarded (a player can't revoke their
 * GM's invites). Join/attach behaviour is covered from commit 60.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';
import {
	createCampaign,
	getCampaign,
	getCampaignByToken,
	membershipOf,
	listCampaignsForUser,
	rotateInviteToken,
	joinCampaign
} from './campaigns.ts';

function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

let db: Db;
let gm: string;
let player: string;

beforeEach(async () => {
	db = freshDb();
	const [g] = await db.insert(schema.users).values({ email: 'gm@x' }).returning();
	const [p] = await db.insert(schema.users).values({ email: 'player@x' }).returning();
	gm = g.id;
	player = p.id;
});

describe('createCampaign', () => {
	it('creates the campaign and seats the owner as GM', async () => {
		const campaign = await createCampaign(db, {
			gameId: 'stonetop',
			name: 'Ringwall',
			ownerId: gm
		});
		expect(campaign.ownerId).toBe(gm);
		expect(campaign.inviteToken).toMatch(/[0-9a-f-]{36}/);

		const seat = await membershipOf(db, campaign.id, gm);
		expect(seat?.role).toBe('gm');
	});
});

describe('lookups', () => {
	it('finds a campaign by its invite token', async () => {
		const campaign = await createCampaign(db, { gameId: 'stonetop', name: 'R', ownerId: gm });
		const found = await getCampaignByToken(db, campaign.inviteToken);
		expect(found?.id).toBe(campaign.id);
	});

	it('returns undefined for an empty or unknown token', async () => {
		await createCampaign(db, { gameId: 'stonetop', name: 'R', ownerId: gm });
		expect(await getCampaignByToken(db, '')).toBeUndefined();
		expect(await getCampaignByToken(db, 'nope')).toBeUndefined();
	});

	it('reports non-membership as undefined', async () => {
		const campaign = await createCampaign(db, { gameId: 'stonetop', name: 'R', ownerId: gm });
		expect(await membershipOf(db, campaign.id, player)).toBeUndefined();
	});
});

describe('listCampaignsForUser', () => {
	it('lists only campaigns the user has a seat in, with their role', async () => {
		const owned = await createCampaign(db, { gameId: 'stonetop', name: 'Mine', ownerId: gm });
		// A campaign the player is not in.
		await createCampaign(db, { gameId: 'stonetop', name: 'Theirs', ownerId: player });

		const forGm = await listCampaignsForUser(db, gm);
		expect(forGm.map((c) => c.name)).toEqual(['Mine']);
		expect(forGm[0].role).toBe('gm');

		// Seat the player into the GM's campaign and it appears for them as a player.
		await db
			.insert(schema.campaignMembers)
			.values({ campaignId: owned.id, userId: player, role: 'player' });
		const forPlayer = await listCampaignsForUser(db, player);
		expect(forPlayer.find((c) => c.id === owned.id)?.role).toBe('player');
	});
});

describe('rotateInviteToken', () => {
	it('issues a fresh token for the owner and invalidates the old one', async () => {
		const campaign = await createCampaign(db, { gameId: 'stonetop', name: 'R', ownerId: gm });
		const old = campaign.inviteToken;
		const rotated = await rotateInviteToken(db, campaign.id, gm);
		expect(rotated?.inviteToken).not.toBe(old);
		expect(await getCampaignByToken(db, old)).toBeUndefined();
		expect((await getCampaignByToken(db, rotated!.inviteToken))?.id).toBe(campaign.id);
	});

	it('refuses to rotate for a non-owner', async () => {
		const campaign = await createCampaign(db, { gameId: 'stonetop', name: 'R', ownerId: gm });
		expect(await rotateInviteToken(db, campaign.id, player)).toBeUndefined();
		// The original token still works.
		expect((await getCampaign(db, campaign.id))?.inviteToken).toBe(campaign.inviteToken);
	});
});

describe('joinCampaign', () => {
	it('seats a newcomer as a player', async () => {
		const campaign = await createCampaign(db, { gameId: 'stonetop', name: 'R', ownerId: gm });
		const result = await joinCampaign(db, campaign.inviteToken, player);
		expect(result?.joined).toBe(true);
		expect(result?.role).toBe('player');
		expect((await membershipOf(db, campaign.id, player))?.role).toBe('player');
	});

	it('is idempotent for an existing member and never demotes the GM', async () => {
		const campaign = await createCampaign(db, { gameId: 'stonetop', name: 'R', ownerId: gm });
		// GM opens their own invite link.
		const result = await joinCampaign(db, campaign.inviteToken, gm);
		expect(result?.joined).toBe(false);
		expect(result?.role).toBe('gm');
		// Still exactly one seat for the GM.
		const seats = await db
			.select()
			.from(schema.campaignMembers)
			.where(eq(schema.campaignMembers.campaignId, campaign.id));
		expect(seats).toHaveLength(1);
	});

	it('returns undefined for a bad token', async () => {
		await createCampaign(db, { gameId: 'stonetop', name: 'R', ownerId: gm });
		expect(await joinCampaign(db, 'not-a-token', player)).toBeUndefined();
	});
});
