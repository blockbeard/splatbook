/**
 * Where the shell's half meets the game's. The points of interest: pack files
 * are fetched once rather than per request; a command is reduced from the
 * *stored* state; and a viewer only ever gets their own projection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as schema from '../db/schema.ts';
import type { Db } from '../db/entities.ts';
import { createCardTable, TABLE_RETENTION_MS } from '../db/card-tables.ts';
import { eq } from 'drizzle-orm';
import { requestSeat, claimGmSeat } from '../db/card-table-seats.ts';
import { clearPackCache, loadPack, loadTable, runCommand, syncTable, viewFor } from './service.ts';
import { seededRng } from '$lib/games/hmtw/engine';
import { getGame } from '$lib/games';
import '$lib/games';

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'hmtw'
);

/** Serve the real pack from disk, counting how often each file is asked for. */
function packFetch() {
	const calls: string[] = [];
	const fn = (async (url: string) => {
		calls.push(url);
		const file = String(url).replace('/content-packs/hmtw/', '');
		return new Response(await readFile(join(packRoot, file), 'utf8'), {
			headers: { 'content-type': 'application/json' }
		});
	}) as unknown as typeof fetch;
	return { fn, calls };
}

let db: Db;
let token: string;
let gmSeatId: string;
let gmClaim: { seatId: string; secret: string };
let tableId: string;
/** Every statement the database has been sent, for counting round trips. */
let statements: string[];

/** Same shape as the other db tests: migrate on the concrete type, then widen. */
function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const database = drizzle(sqlite, {
		schema,
		logger: { logQuery: (query) => statements.push(query) }
	});
	migrate(database, { migrationsFolder: './drizzle' });
	return database;
}

beforeEach(async () => {
	statements = [];
	db = freshDb();

	const [user] = await db.insert(schema.users).values({ email: 'gm@x' }).returning();
	// Created the way a route will: the game makes its own opening state.
	const module = getGame('hmtw')!.cardTable!;
	const opening = module.create(
		await loadPack(packFetch().fn, 'hmtw', module.packFiles),
		seededRng(3)
	);
	const created = await createCardTable(db, {
		gameId: 'hmtw',
		name: 'Thursday',
		ownerId: user.id,
		state: opening.state,
		stateVersion: opening.stateVersion
	});
	if (!created.ok) throw new Error('create refused');
	token = created.table.roomToken;

	const seat = await requestSeat(db, created.table.id, 'The GM');
	if (!seat.ok) throw new Error('seat refused');
	gmSeatId = seat.ticket.seat.id;
	gmClaim = { seatId: gmSeatId, secret: seat.ticket.secret };
	tableId = created.table.id;
	await claimGmSeat(db, created.table.id, gmSeatId);

	// Cleared *after* setup: this fixture loads the pack itself, and a warm
	// cache would make the cache tests below assert nothing.
	clearPackCache();
});

const load = (pack: ReturnType<typeof packFetch>, claim?: { seatId: string; secret: string }) =>
	loadTable(db, pack.fn, token, claim, undefined);

describe('the pack cache', () => {
	it('fetches each file once, however many requests arrive', async () => {
		const pack = packFetch();
		await load(pack);
		await load(pack);
		await load(pack);
		// Two files, fetched once each. Without this a single command meant four
		// round trips for content that cannot have changed.
		expect(pack.calls).toHaveLength(2);
		expect(new Set(pack.calls).size).toBe(2);
	});

	it('shares one fetch between simultaneous first requests', async () => {
		const pack = packFetch();
		await Promise.all([load(pack), load(pack), load(pack)]);
		expect(pack.calls).toHaveLength(2);
	});

	it('does not remember a failure as the answer', async () => {
		let fail = true;
		const fn = (async (url: string) => {
			if (fail) return new Response('nope', { status: 404 });
			const file = String(url).replace('/content-packs/hmtw/', '');
			return new Response(await readFile(join(packRoot, file), 'utf8'));
		}) as unknown as typeof fetch;

		await expect(loadPack(fn, 'hmtw', ['data/deck.json'])).rejects.toThrow();
		fail = false;
		await expect(loadPack(fn, 'hmtw', ['data/deck.json'])).resolves.toBeDefined();
	});
});

describe('loading a table', () => {
	it('gives nothing for a token that names nothing', async () => {
		expect(
			await loadTable(db, packFetch().fn, 'not-a-token', undefined, undefined)
		).toBeUndefined();
	});

	it('reconciles the engine’s seats with the shell’s', async () => {
		const ctx = await load(packFetch());
		expect(ctx).toBeDefined();
		const state = ctx!.state as { seats: string[]; gmSeat: string | null };
		expect(state.seats).toEqual([gmSeatId]);
		expect(state.gmSeat).toBe(gmSeatId);
	});

	it('knows a seat by its ticket, and a stranger by the absence of one', async () => {
		const pack = packFetch();
		const anon = await load(pack);
		expect(anon?.seat).toBeUndefined();
	});
});

describe('running a command', () => {
	it('applies it, logs a public fact, and hands back the new view', async () => {
		const ctx = (await load(packFetch()))!;
		const res = await runCommand(
			db,
			ctx,
			{ type: 'move', from: { zone: 'deck:player' }, to: 'discard:player' },
			0,
			'req-1',
			seededRng(1)
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.table.version).toBe(1);
		expect(res.event.kind).toBe('move');
		// The log says where, never what.
		expect(JSON.stringify(res.event.data)).not.toMatch(/swords|cups|wands|pentacles/);
	});

	it('reduces from the stored state, not the one the request loaded', async () => {
		const ctx = (await load(packFetch()))!;
		await runCommand(
			db,
			ctx,
			{ type: 'move', from: { zone: 'deck:player' }, to: 'discard:player' },
			0,
			'a',
			seededRng(1)
		);
		// The same stale context, one version behind, must build on what landed.
		const second = await runCommand(
			db,
			ctx,
			{ type: 'move', from: { zone: 'deck:player' }, to: 'discard:player' },
			1,
			'b',
			seededRng(1)
		);
		expect(second.ok).toBe(true);
		const fresh = (await load(packFetch()))!;
		const view = (await viewFor(db, fresh, 0)).state as {
			zones: Record<string, { count: number }>;
		};
		expect(view.zones['discard:player'].count).toBe(2);
	});
});

describe('what a viewer is handed', () => {
	it('is a projection, never the table', async () => {
		const ctx = (await load(packFetch()))!;
		const view = await viewFor(db, ctx, 0);
		const state = view.state as { zones: Record<string, { cards?: string[]; count: number }> };
		// The draw pile's size is public; its order is not, to anyone.
		expect(state.zones['deck:player'].count).toBe(57);
		expect(state.zones['deck:player'].cards).toBeUndefined();
		expect(JSON.stringify(view)).not.toContain('swords-ace');
	});

	it('carries the version a client should send back as its cursor', async () => {
		const ctx = (await load(packFetch()))!;
		expect((await viewFor(db, ctx, 0)).version).toBe(ctx.row.version);
	});
});

describe('answering a poll', () => {
	const poll = (
		cursor: { since: number; stamp?: string },
		/** `null` for somebody holding no ticket; left out, the GM asks. */
		claim: { seatId: string; secret: string } | null = gmClaim
	) => syncTable(db, packFetch().fn, token, claim ?? undefined, undefined, cursor);

	/** A first poll, which has no stamp to send and so always gets a view. */
	async function firstView() {
		const view = await poll({ since: 0 });
		if (!view || view === 'unchanged') throw new Error('expected a view');
		return view;
	}

	const move = async (version: number, key: string) => {
		const ctx = (await load(packFetch(), gmClaim))!;
		const res = await runCommand(
			db,
			ctx,
			{ type: 'move', from: { zone: 'deck:player' }, to: 'discard:player' },
			version,
			key,
			seededRng(1)
		);
		if (!res.ok) throw new Error(`command refused: ${res.reason}`);
	};

	it('gives a client with no stamp the whole view, and a stamp to send back', async () => {
		const view = await firstView();
		expect(view.version).toBe(0);
		expect(view.seatId).toBe(gmSeatId);
		expect(view.seats).toHaveLength(1);
		expect(view.stamp).toMatch(/^[0-9a-f]{16}$/);
	});

	it('says nothing has changed in a single statement', async () => {
		const { stamp } = await firstView();
		statements.length = 0;
		expect(await poll({ since: 0, stamp })).toBe('unchanged');
		// The whole point: an idle table costs one round trip a poll, and its
		// state is never read.
		expect(statements).toHaveLength(1);
		expect(statements[0]).not.toMatch(/"state"/);
	});

	it('delivers a command that landed', async () => {
		const { stamp } = await firstView();
		await move(0, 'poll-1');
		const view = await poll({ since: 0, stamp });
		if (!view || view === 'unchanged') throw new Error('expected a view');
		expect(view.version).toBe(1);
		expect(view.events.map((e) => e.kind)).toEqual(['move']);
	});

	it('spends three statements when there is something to deliver', async () => {
		const { stamp } = await firstView();
		await move(0, 'poll-2');
		statements.length = 0;
		await poll({ since: 0, stamp });
		// The peek, the table, the events.
		expect(statements).toHaveLength(3);
	});

	it('notices the roster move though the version has not', async () => {
		const { stamp } = await firstView();
		const arrival = await requestSeat(db, tableId, 'Grimwold');
		expect(arrival.ok).toBe(true);
		const view = await poll({ since: 0, stamp });
		if (!view || view === 'unchanged') throw new Error('expected a view');
		// No card moved, and the GM still has to see somebody asking to sit.
		expect(view.version).toBe(0);
		expect(view.seats.map((s) => s.name)).toEqual(['The GM', 'Grimwold']);
		expect(view.stamp).not.toBe(stamp);
		expect(await poll({ since: 0, stamp: view.stamp })).toBe('unchanged');
	});

	it('will not let one viewer’s stamp stand for another’s', async () => {
		const { stamp } = await firstView();
		// The same roster, asked about by somebody holding no seat: what they may
		// see differs, so the GM's stamp must not earn them a "nothing changed".
		const view = await poll({ since: 0, stamp }, null);
		if (!view || view === 'unchanged') throw new Error('expected a view');
		expect(view.seatId).toBeNull();
		expect(view.stamp).not.toBe(stamp);
	});

	it('treats a cursor that has fallen behind as a change', async () => {
		await move(0, 'poll-3');
		const view = await poll({ since: 1 });
		if (!view || view === 'unchanged') throw new Error('expected a view');
		expect(await poll({ since: 0, stamp: view.stamp })).not.toBe('unchanged');
		expect(await poll({ since: 1, stamp: view.stamp })).toBe('unchanged');
	});

	it('gives nothing for a token that names nothing, or a table that has expired', async () => {
		expect(
			await syncTable(db, packFetch().fn, 'not-a-token', undefined, undefined, { since: 0 })
		).toBeUndefined();

		const { stamp } = await firstView();
		await db
			.update(schema.cardTables)
			.set({ lastActiveAt: new Date(Date.now() - TABLE_RETENTION_MS - 1000) })
			.where(eq(schema.cardTables.id, tableId));
		// Even to a client whose cursor and stamp still match: gone is gone.
		expect(await poll({ since: 0, stamp })).toBeUndefined();
	});

	it('writes nothing, whatever it finds', async () => {
		const { stamp } = await firstView();
		await move(0, 'poll-4');
		statements.length = 0;
		await poll({ since: 0, stamp });
		await poll({ since: 1 });
		expect(statements.filter((q) => !/^select/i.test(q))).toEqual([]);
	});
});
