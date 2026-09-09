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
import { createCardTable } from '../db/card-tables.ts';
import { requestSeat, claimGmSeat } from '../db/card-table-seats.ts';
import { clearPackCache, loadPack, loadTable, runCommand, viewFor } from './service.ts';
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

/** Same shape as the other db tests: migrate on the concrete type, then widen. */
function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const database = drizzle(sqlite, { schema });
	migrate(database, { migrationsFolder: './drizzle' });
	return database;
}

beforeEach(async () => {
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
