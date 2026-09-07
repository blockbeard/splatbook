/**
 * Command service tests. The points of interest: a retried command lands once;
 * losing a race changes nothing at all; the event log carries the version a
 * client already has as its cursor; and nothing private reaches the log.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';
import { createCardTable, getCardTable } from './card-tables.ts';
import {
	applyCommand,
	eventsSince,
	findByRequest,
	type CommandOutcome
} from './card-table-commands.ts';

function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

let db: Db;
let tableId: string;

beforeEach(async () => {
	db = freshDb();
	const [user] = await db.insert(schema.users).values({ email: 'gm@x' }).returning();
	const created = await createCardTable(db, {
		gameId: 'hmtw',
		name: 'Thursday',
		ownerId: user.id,
		state: { moves: 0 },
		stateVersion: 5
	});
	if (!created.ok) throw new Error('create refused');
	tableId = created.table.id;
});

/** A stand-in reducer: counts moves, and says something public about it. */
const bump = (state: unknown) => ({
	ok: true as const,
	state: { moves: ((state as { moves: number }).moves ?? 0) + 1 },
	stateVersion: 5,
	kind: 'move',
	data: { seat: 'somebody' }
});

const run = (
	over: Partial<Parameters<typeof applyCommand>[1]> = {},
	reduce: (state: unknown) => CommandOutcome = bump
) =>
	applyCommand(
		db,
		{ tableId, actorSeatId: null, expectedVersion: 0, requestHash: 'r1', ...over },
		reduce
	);

describe('applying a command', () => {
	it('advances the state and logs a public fact', async () => {
		const res = await run();
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.table.state).toEqual({ moves: 1 });
		expect(res.table.version).toBe(1);
		expect(res.event.kind).toBe('move');
		expect(res.event.version).toBe(1);
		expect(res.replayed).toBe(false);
	});

	it('numbers events with the version a client already holds', async () => {
		// One counter, not two: a client's cursor is its version.
		await run({ requestHash: 'a' });
		await run({ expectedVersion: 1, requestHash: 'b' });
		const events = await eventsSince(db, tableId, 0);
		expect(events.map((e) => e.version)).toEqual([1, 2]);
		expect(await eventsSince(db, tableId, 1)).toHaveLength(1);
	});

	it('lands a retried command once, and gives back the first answer', async () => {
		// A dropped response must not cost a player the card twice.
		const first = await run();
		const retry = await run();
		expect(retry.ok).toBe(true);
		if (!first.ok || !retry.ok) return;
		expect(retry.replayed).toBe(true);
		expect(retry.event.id).toBe(first.event.id);

		const table = await getCardTable(db, tableId);
		expect(table?.state).toEqual({ moves: 1 });
		expect(table?.version).toBe(1);
		expect(await eventsSince(db, tableId, 0)).toHaveLength(1);
	});

	it('changes nothing when somebody else got there first', async () => {
		await run({ requestHash: 'a' });
		const loser = await run({ requestHash: 'b', expectedVersion: 0 });
		expect(loser).toMatchObject({ ok: false, reason: 'conflict' });

		// The reducer is pure, so its result is simply discarded.
		const table = await getCardTable(db, tableId);
		expect(table?.state).toEqual({ moves: 1 });
		expect(await eventsSince(db, tableId, 0)).toHaveLength(1);
	});

	it('passes a refusal through without writing', async () => {
		const res = await run({}, () => ({ ok: false, reason: 'no-such-zone' }));
		expect(res).toEqual({ ok: false, reason: 'rejected', detail: 'no-such-zone' });
		expect((await getCardTable(db, tableId))?.version).toBe(0);
		expect(await eventsSince(db, tableId, 0)).toEqual([]);
	});

	it('says so when the table is not there', async () => {
		const res = await applyCommand(
			db,
			{ tableId: 'nope', actorSeatId: null, expectedVersion: 0, requestHash: 'r' },
			bump
		);
		expect(res).toEqual({ ok: false, reason: 'no-such-table' });
	});

	it('keeps request keys to their own table', async () => {
		const [user] = await db.insert(schema.users).values({ email: 'other@x' }).returning();
		const other = await createCardTable(db, {
			gameId: 'hmtw',
			name: 'Other',
			ownerId: user.id,
			state: { moves: 0 },
			stateVersion: 5
		});
		if (!other.ok) throw new Error('create refused');

		await run({ requestHash: 'shared' });
		const elsewhere = await applyCommand(
			db,
			{
				tableId: other.table.id,
				actorSeatId: null,
				expectedVersion: 0,
				requestHash: 'shared'
			},
			bump
		);
		// The same key at a different table is a different command.
		expect(elsewhere.ok).toBe(true);
		if (elsewhere.ok) expect(elsewhere.replayed).toBe(false);
	});
});

describe('the event log is public by contract', () => {
	it('records only what the game chose to say out loud', async () => {
		// The reducer decides what goes in `data`. The point of the contract is
		// that the shell stores it verbatim and shows it to everyone, so a game
		// putting a card id here would be leaking it to the whole table.
		const res = await run({}, () => ({
			ok: true,
			state: { moves: 1, secret: 'ace-of-cups' },
			stateVersion: 5,
			kind: 'deal',
			data: { seat: 's3', count: 4 }
		}));
		expect(res.ok).toBe(true);
		if (!res.ok) return;

		// The private half lives in the state, which reaches a client only
		// through the game's per-seat projection.
		expect(JSON.stringify(res.event.data)).not.toContain('ace-of-cups');
		expect(res.event.data).toEqual({ seat: 's3', count: 4 });
	});

	it('finds an earlier run of the same request', async () => {
		await run({ requestHash: 'once' });
		expect(await findByRequest(db, tableId, 'once')).toBeDefined();
		expect(await findByRequest(db, tableId, 'never')).toBeUndefined();
	});

	it('gives a returning client the recent past rather than an afternoon of it', async () => {
		let version = 0;
		for (let i = 0; i < 12; i++) {
			const res = await run({ expectedVersion: version, requestHash: `r${i}` });
			if (res.ok) version = res.table.version;
		}
		expect(await eventsSince(db, tableId, 0, 5)).toHaveLength(5);
		expect(await eventsSince(db, tableId, 10)).toHaveLength(2);
	});

	it('goes when its table goes', async () => {
		await run();
		await db.delete(schema.cardTables);
		expect(await eventsSince(db, tableId, 0)).toEqual([]);
	});
});
