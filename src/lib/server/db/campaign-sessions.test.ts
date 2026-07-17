/**
 * Session-ledger service tests (phase 17). The points of interest: only the GM
 * can record; the number counts 1, 2, 3… per campaign (not globally); triggers
 * ride through opaquely and awards read back whole; the history lists newest
 * first; and records cascade away with their campaign.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';
import { createCampaign, joinCampaign } from './campaigns.ts';
import {
	recordCampaignSession,
	listCampaignSessions,
	updateCampaignSessionNotes
} from './campaign-sessions.ts';

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

/** A representative record — two group triggers, one character awarded 3 XP. */
function sampleRecord(overrides: Partial<Parameters<typeof recordCampaignSession>[2]> = {}) {
	return {
		campaignId,
		triggers: { group: ['learned', 'defeated'], personal: { c1: ['instinct'] } },
		awards: [{ entityId: 'c1', name: 'Ryn', xp: 3 }],
		notes: 'The bridge burned.',
		...overrides
	};
}

describe('recordCampaignSession', () => {
	it('writes a numbered record for the GM, storing triggers and awards whole', async () => {
		const row = await recordCampaignSession(db, gm, sampleRecord());
		expect(row).toBeDefined();
		expect(row?.number).toBe(1);
		expect(row?.campaignId).toBe(campaignId);
		expect(row?.triggers).toEqual({
			group: ['learned', 'defeated'],
			personal: { c1: ['instinct'] }
		});
		expect(row?.awards).toEqual([{ entityId: 'c1', name: 'Ryn', xp: 3 }]);
		expect(row?.notes).toBe('The bridge burned.');
		expect(row?.date).toBeInstanceOf(Date);
	});

	it('counts sessions per campaign, not globally', async () => {
		await recordCampaignSession(db, gm, sampleRecord());
		await recordCampaignSession(db, gm, sampleRecord({ notes: 'Second night.' }));

		// A different table starts its own count at 1.
		const other = await createCampaign(db, { gameId: 'stonetop', name: 'B', ownerId: gm });
		const elsewhere = await recordCampaignSession(db, gm, sampleRecord({ campaignId: other.id }));
		expect(elsewhere?.number).toBe(1);

		const third = await recordCampaignSession(db, gm, sampleRecord({ notes: 'Third.' }));
		expect(third?.number).toBe(3);
	});

	it('refuses a player and a stranger', async () => {
		expect(await recordCampaignSession(db, player, sampleRecord())).toBeUndefined();
		expect(await recordCampaignSession(db, outsider, sampleRecord())).toBeUndefined();
		expect(await listCampaignSessions(db, campaignId)).toEqual([]);
	});
});

describe('listCampaignSessions', () => {
	it('lists one campaign’s history newest first', async () => {
		await recordCampaignSession(db, gm, sampleRecord({ notes: 'One' }));
		await recordCampaignSession(db, gm, sampleRecord({ notes: 'Two' }));
		const other = await createCampaign(db, { gameId: 'stonetop', name: 'B', ownerId: gm });
		await recordCampaignSession(db, gm, sampleRecord({ campaignId: other.id, notes: 'Elsewhere' }));

		const history = await listCampaignSessions(db, campaignId);
		expect(history.map((s) => [s.number, s.notes])).toEqual([
			[2, 'Two'],
			[1, 'One']
		]);
	});

	it('cascades away with the campaign', async () => {
		await recordCampaignSession(db, gm, sampleRecord());
		await db.delete(schema.campaigns).where(eq(schema.campaigns.id, campaignId));
		const [orphan] = await db.select().from(schema.campaignSessions);
		expect(orphan).toBeUndefined();
	});
});

describe('updateCampaignSessionNotes (commit 112)', () => {
	it('lets the GM fix the notes after the fact, touching nothing else', async () => {
		const recorded = await recordCampaignSession(db, gm, sampleRecord());
		const updated = await updateCampaignSessionNotes(db, recorded!.id, gm, {
			notes: 'The bridge burned — and it was Bram’s fault.'
		});
		expect(updated?.notes).toBe('The bridge burned — and it was Bram’s fault.');
		// History itself doesn't take edits, and the other notes field is untouched.
		expect(updated?.number).toBe(1);
		expect(updated?.awards).toEqual(recorded!.awards);
		expect(updated?.triggers).toEqual(recorded!.triggers);
		expect(updated?.privateNotes).toBe(recorded!.privateNotes);
	});

	it('refuses a player, a stranger, a session that doesn’t exist, and an empty patch', async () => {
		const recorded = await recordCampaignSession(db, gm, sampleRecord());
		expect(
			await updateCampaignSessionNotes(db, recorded!.id, player, { notes: 'mine now' })
		).toBeUndefined();
		expect(
			await updateCampaignSessionNotes(db, recorded!.id, outsider, { notes: 'hax' })
		).toBeUndefined();
		expect(
			await updateCampaignSessionNotes(db, 'no-such-id', gm, { notes: 'void' })
		).toBeUndefined();
		expect(await updateCampaignSessionNotes(db, recorded!.id, gm, {})).toBeUndefined();
		const [row] = await db.select().from(schema.campaignSessions);
		expect(row.notes).toBe('The bridge burned.');
	});
});

describe('private GM notes', () => {
	it('stores them at record time, defaulting empty, and edits them separately', async () => {
		const bare = await recordCampaignSession(db, gm, sampleRecord());
		expect(bare?.privateNotes).toBe('');

		const secret = await recordCampaignSession(
			db,
			gm,
			sampleRecord({ privateNotes: 'Bram is the cult’s inside man.' })
		);
		expect(secret?.privateNotes).toBe('Bram is the cult’s inside man.');
		expect(secret?.notes).toBe('The bridge burned.');

		const updated = await updateCampaignSessionNotes(db, secret!.id, gm, {
			privateNotes: 'Bram is innocent after all.'
		});
		expect(updated?.privateNotes).toBe('Bram is innocent after all.');
		// The shared notes didn't move.
		expect(updated?.notes).toBe('The bridge burned.');
	});
});
