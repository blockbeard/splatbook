/**
 * Roll-log service tests. The points of interest are: only a member can append
 * to a campaign's log; the log reads back newest-first with each roller's name
 * and its `RollResult` intact; it's scoped to one campaign; and rolls cascade
 * away when their campaign or their roller is deleted.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import type { RollResult } from '$lib/dice';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';
import { createCampaign, joinCampaign } from './campaigns.ts';
import { logRoll, listCampaignRolls } from './rolls.ts';

function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

/** A representative dice-engine outcome to store. */
function sampleResult(total: number): RollResult {
	return {
		notation: '2d6',
		mode: 'normal',
		dice: [
			{ sides: 6, value: Math.min(total, 6), kept: true },
			{ sides: 6, value: Math.max(total - 6, 1), kept: true }
		],
		modifier: 0,
		total
	};
}

let db: Db;
let gm: string;
let player: string;
let outsider: string;
let campaignId: string;

beforeEach(async () => {
	db = freshDb();
	const [g] = await db.insert(schema.users).values({ email: 'gm@x', name: 'Vera' }).returning();
	const [p] = await db.insert(schema.users).values({ email: 'player@x', name: 'Bram' }).returning();
	const [o] = await db.insert(schema.users).values({ email: 'out@x', name: 'Nobody' }).returning();
	gm = g.id;
	player = p.id;
	outsider = o.id;
	const campaign = await createCampaign(db, { gameId: 'stonetop', name: 'Ringwall', ownerId: gm });
	campaignId = campaign.id;
	await joinCampaign(db, campaign.inviteToken, player);
});

describe('logRoll', () => {
	it('appends a member roll and returns the stored row', async () => {
		const row = await logRoll(db, {
			campaignId,
			actorId: player,
			label: 'Roll +DEX',
			result: sampleResult(9)
		});
		expect(row?.id).toMatch(/[0-9a-f-]{36}/);
		expect(row?.label).toBe('Roll +DEX');
		expect(row?.result.total).toBe(9);
		expect(row?.createdAt).toBeInstanceOf(Date);
	});

	it('refuses a non-member and writes nothing', async () => {
		const row = await logRoll(db, {
			campaignId,
			actorId: outsider,
			label: 'Roll +STR',
			result: sampleResult(7)
		});
		expect(row).toBeUndefined();
		expect(await listCampaignRolls(db, campaignId)).toHaveLength(0);
	});
});

describe('listCampaignRolls', () => {
	it('returns rolls newest-first with the roller name and result intact', async () => {
		await logRoll(db, { campaignId, actorId: gm, label: 'first', result: sampleResult(6) });
		await logRoll(db, { campaignId, actorId: player, label: 'second', result: sampleResult(11) });

		const log = await listCampaignRolls(db, campaignId);
		expect(log.map((r) => r.label)).toEqual(['second', 'first']);
		expect(log[0].actorName).toBe('Bram');
		expect(log[0].result.total).toBe(11);
		expect(log[0].result.mode).toBe('normal');
	});

	it('scopes to one campaign', async () => {
		const other = await createCampaign(db, { gameId: 'stonetop', name: 'Elsewhere', ownerId: gm });
		await logRoll(db, { campaignId, actorId: gm, label: 'here', result: sampleResult(8) });
		await logRoll(db, {
			campaignId: other.id,
			actorId: gm,
			label: 'there',
			result: sampleResult(8)
		});

		const log = await listCampaignRolls(db, campaignId);
		expect(log.map((r) => r.label)).toEqual(['here']);
	});

	it('caps the result at the given limit', async () => {
		for (let i = 0; i < 5; i++) {
			await logRoll(db, { campaignId, actorId: gm, label: `r${i}`, result: sampleResult(7) });
		}
		expect(await listCampaignRolls(db, campaignId, 2)).toHaveLength(2);
	});
});

describe('cascade', () => {
	it("drops a campaign's rolls when the campaign is deleted", async () => {
		await logRoll(db, { campaignId, actorId: gm, label: 'x', result: sampleResult(7) });
		await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
		expect(await db.select().from(schema.rolls)).toHaveLength(0);
	});

	it("drops a roller's rolls when the account is deleted", async () => {
		await logRoll(db, { campaignId, actorId: player, label: 'x', result: sampleResult(7) });
		await logRoll(db, { campaignId, actorId: gm, label: 'y', result: sampleResult(7) });
		await db.delete(schema.users).where(eq(schema.users.id, player));

		const log = await listCampaignRolls(db, campaignId);
		expect(log.map((r) => r.label)).toEqual(['y']);
	});
});
