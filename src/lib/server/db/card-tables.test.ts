/**
 * Card-table service tests. The points of interest: a table is found by the
 * token in its URL rather than by membership; retention is kept by the act of
 * asking rather than by a scheduler; the owner alone can revoke or delete; and
 * a stale write loses rather than clobbering whoever got there first.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import type { Db } from './entities.ts';
import {
	TABLE_RETENTION_MS,
	countLiveTables,
	createCardTable,
	deleteCardTable,
	expireByToken,
	getCardTable,
	getCardTableByToken,
	listCardTablesForOwner,
	listSeats,
	rotateRoomToken,
	saveTableState,
	sweepExpiredTables,
	touchCardTable
} from './card-tables.ts';
import { MAX_COMMANDS_PER_TABLE, MAX_TABLES_PER_OWNER } from '../../card-table-limits.ts';

function freshDb(): Db {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

let db: Db;
let owner: string;
let other: string;

beforeEach(async () => {
	db = freshDb();
	const [a] = await db.insert(schema.users).values({ email: 'gm@x' }).returning();
	const [b] = await db.insert(schema.users).values({ email: 'other@x' }).returning();
	owner = a.id;
	other = b.id;
});

/** Unwrap a successful create; a refusal here is a test failure. */
async function make(name = 'Thursday game') {
	const res = await createCardTable(db, {
		gameId: 'hmtw',
		name,
		ownerId: owner,
		state: { zones: {} },
		stateVersion: 5
	});
	if (!res.ok) throw new Error(`create refused: ${res.reason}`);
	return res.table;
}

describe('creating a table', () => {
	it('stores the game’s blob without looking inside it', async () => {
		const row = await make();
		expect(row.gameId).toBe('hmtw');
		expect(row.state).toEqual({ zones: {} });
		expect(row.stateVersion).toBe(5);
		expect(row.version).toBe(0);
		expect(row.commandCount).toBe(0);
	});

	it('gives every table its own token', async () => {
		const tokens = new Set<string>();
		for (let i = 0; i < 5; i++) tokens.add((await make(`t${i}`)).roomToken);
		expect(tokens.size).toBe(5);
		for (const token of tokens) expect(token.length).toBeGreaterThan(20);
	});

	it('lists a creator’s own tables, most recently used first', async () => {
		const older = await make('older');
		await make('newer');
		await touchCardTable(db, older.id, Date.now() - 60_000);
		const rows = await listCardTablesForOwner(db, owner);
		expect(rows.map((r) => r.name)).toEqual(['newer', 'older']);
		expect(await listCardTablesForOwner(db, other)).toEqual([]);
	});
});

describe('the limits', () => {
	it('caps how many live tables one account may hold', async () => {
		for (let i = 0; i < MAX_TABLES_PER_OWNER; i++) await make(`table ${i}`);
		const refused = await createCardTable(db, {
			gameId: 'hmtw',
			name: 'One too many',
			ownerId: owner,
			state: {},
			stateVersion: 5
		});
		expect(refused).toEqual({ ok: false, reason: 'too-many-tables' });
	});

	it('counts live tables only, so an expired one frees its place', async () => {
		const first = await make('old');
		for (let i = 1; i < MAX_TABLES_PER_OWNER; i++) await make(`table ${i}`);
		expect(await countLiveTables(db, owner)).toBe(MAX_TABLES_PER_OWNER);

		await touchCardTable(db, first.id, Date.now() - TABLE_RETENTION_MS - 1);
		expect(await countLiveTables(db, owner)).toBe(MAX_TABLES_PER_OWNER - 1);
		const created = await createCardTable(db, {
			gameId: 'hmtw',
			name: 'Room again',
			ownerId: owner,
			state: {},
			stateVersion: 5
		});
		expect(created.ok).toBe(true);
	});

	it('leaves an expired table out of its owner’s list', async () => {
		// Every other read path treats it as absent. A listing that disagreed
		// would be the one place the promise looked broken: a row with a
		// working-looking link that answers 404.
		const live = await make('in use');
		const stale = await make('abandoned');
		await touchCardTable(db, stale.id, Date.now() - TABLE_RETENTION_MS - 1);

		const listed = await listCardTablesForOwner(db, owner);
		expect(listed.map((t) => t.id)).toEqual([live.id]);
	});

	it('does not count someone else’s tables against you', async () => {
		for (let i = 0; i < MAX_TABLES_PER_OWNER; i++) await make(`table ${i}`);
		const theirs = await createCardTable(db, {
			gameId: 'hmtw',
			name: 'Theirs',
			ownerId: other,
			state: {},
			stateVersion: 5
		});
		expect(theirs.ok).toBe(true);
	});

	it('stops accepting commands at the ceiling', async () => {
		const row = await make();
		// Reach the ceiling directly; playing there would take a hundred thousand
		// card moves, which is the point of the number.
		await db
			.update(schema.cardTables)
			.set({ commandCount: MAX_COMMANDS_PER_TABLE })
			.where(eq(schema.cardTables.id, row.id));
		// Distinguishable from a race, because a client that could not tell would
		// retry a finished table forever.
		expect(await saveTableState(db, row.id, 0, { more: true }, 5)).toEqual({
			ok: false,
			reason: 'exhausted'
		});
	});
});

describe('finding a table by its token', () => {
	it('is how someone with no account arrives', async () => {
		const row = await make();
		const found = await getCardTableByToken(db, row.roomToken);
		expect(found?.id).toBe(row.id);
	});

	it('says nothing for a token that was never issued', async () => {
		expect(await getCardTableByToken(db, 'not-a-token')).toBeUndefined();
	});

	it('treats a table nobody has touched for six weeks as gone', async () => {
		const row = await make();
		await touchCardTable(db, row.id, Date.now() - TABLE_RETENTION_MS - 1000);
		expect(await getCardTableByToken(db, row.roomToken)).toBeUndefined();
	});

	it('does not delete on the way past — the poll path must never write', async () => {
		// The sync loop asks this about once a second per client. A read that
		// wrote would turn a quiet table into a stream of billed writes on D1.
		const row = await make();
		await touchCardTable(db, row.id, Date.now() - TABLE_RETENTION_MS - 1000);

		await getCardTableByToken(db, row.roomToken);
		const [still] = await db
			.select()
			.from(schema.cardTables)
			.where(eq(schema.cardTables.id, row.id));
		expect(still).toBeDefined();
		// It is gone when the sweep gets to it, which page loads call.
		expect(await sweepExpiredTables(db)).toBe(1);
		expect(await getCardTable(db, row.id)).toBeUndefined();
	});

	it('keeps one touched inside the window', async () => {
		const row = await make();
		await touchCardTable(db, row.id, Date.now() - TABLE_RETENTION_MS + 60_000);
		expect(await getCardTableByToken(db, row.roomToken)).toBeDefined();
	});
});

describe('sweeping', () => {
	it('retires stale tables nobody will ever ask for again', async () => {
		const stale = await make('abandoned');
		const live = await make('in use');
		await touchCardTable(db, stale.id, Date.now() - TABLE_RETENTION_MS - 1);

		expect(await sweepExpiredTables(db)).toBe(1);
		expect(await getCardTable(db, stale.id)).toBeUndefined();
		expect(await getCardTable(db, live.id)).toBeDefined();
	});

	it('is bounded, because it rides along with a request someone is waiting on', async () => {
		for (let i = 0; i < 4; i++) {
			const row = await make(`old ${i}`);
			await touchCardTable(db, row.id, Date.now() - TABLE_RETENTION_MS - 1);
		}
		expect(await sweepExpiredTables(db, 2)).toBe(2);
		// Counted off the rows rather than the listing: the listing hides an
		// expired table whether or not the sweep has reached it, which is the
		// point of it, and would say two were gone either way.
		expect(await db.select().from(schema.cardTables)).toHaveLength(2);
	});

	it('deletes the seats at a table it retires, names and all', async () => {
		// The retention promise is about the guests, not the cards: a seat holds
		// a name somebody typed, and "it ages out after six weeks" has to reach
		// it. The cascade does the work; this is the assertion that it is on.
		const row = await make();
		await db.insert(schema.cardTableSeats).values({ tableId: row.id, name: 'Grimwold' });
		await touchCardTable(db, row.id, Date.now() - TABLE_RETENTION_MS - 1);

		expect(await sweepExpiredTables(db)).toBe(1);
		expect(await db.select().from(schema.cardTableSeats)).toHaveLength(0);
	});
});

describe('expiry on read', () => {
	it('retires the table a stale link names, when somebody follows it', async () => {
		// The earliest anyone ever learns a table has aged out is when they open
		// it, so that is where it goes — rather than waiting for the global sweep
		// to happen past.
		const row = await make();
		await touchCardTable(db, row.id, Date.now() - TABLE_RETENTION_MS - 1);

		expect(await expireByToken(db, row.roomToken)).toBe(true);
		expect(await getCardTable(db, row.id)).toBeUndefined();
	});

	it('leaves a live table alone', async () => {
		const row = await make();
		expect(await expireByToken(db, row.roomToken)).toBe(false);
		expect(await getCardTable(db, row.id)).toBeDefined();
	});

	it('writes nothing for a token that names nothing', async () => {
		// Guessing at tokens must not buy an attacker writes.
		expect(await expireByToken(db, 'not-a-token')).toBe(false);
	});

	it('takes the seats with it', async () => {
		const row = await make();
		await db.insert(schema.cardTableSeats).values({ tableId: row.id, name: 'Grimwold' });
		await touchCardTable(db, row.id, Date.now() - TABLE_RETENTION_MS - 1);

		await expireByToken(db, row.roomToken);
		expect(await db.select().from(schema.cardTableSeats)).toHaveLength(0);
	});
});

describe('the owner’s controls', () => {
	it('rotates the token, revoking every outstanding link', async () => {
		const row = await make();
		const rotated = await rotateRoomToken(db, row.id, owner);
		expect(rotated?.roomToken).not.toBe(row.roomToken);
		// The link someone was sent no longer reaches it — the only way to shut a
		// table to a person, since seats are not accounts.
		expect(await getCardTableByToken(db, row.roomToken)).toBeUndefined();
		expect(await getCardTableByToken(db, rotated!.roomToken)).toBeDefined();
	});

	it('will not let anyone else revoke or delete', async () => {
		const row = await make();
		expect(await rotateRoomToken(db, row.id, other)).toBeUndefined();
		expect(await deleteCardTable(db, row.id, other)).toBe(false);
		expect(await getCardTable(db, row.id)).toBeDefined();
	});

	it('deletes a table and the seats at it', async () => {
		const row = await make();
		await db.insert(schema.cardTableSeats).values({ tableId: row.id, name: 'Grimwold' });
		expect(await deleteCardTable(db, row.id, owner)).toBe(true);
		expect(await listSeats(db, row.id)).toEqual([]);
	});

	it('tidies a creator’s tables when their account goes', async () => {
		const row = await make();
		await db.delete(schema.users).where(eq(schema.users.id, owner));
		expect(await getCardTable(db, row.id)).toBeUndefined();
	});
});

describe('saving state', () => {
	it('bumps the version and counts the command', async () => {
		const row = await make();
		const saved = await saveTableState(db, row.id, 0, { zones: { a: 1 } }, 5);
		expect(saved.ok).toBe(true);
		if (!saved.ok) return;
		expect(saved.table.version).toBe(1);
		expect(saved.table.commandCount).toBe(1);
		expect(saved.table.state).toEqual({ zones: { a: 1 } });
	});

	it('refuses a write built on a version someone has already moved past', async () => {
		const row = await make();
		await saveTableState(db, row.id, 0, { first: true }, 5);

		// Whoever was still holding version 0 loses — "someone got there first",
		// which is the only refusal this design has.
		// A lost race is normal: re-sync and carry on.
		expect(await saveTableState(db, row.id, 0, { second: true }, 5)).toEqual({
			ok: false,
			reason: 'conflict'
		});
		const current = await getCardTable(db, row.id);
		expect(current?.state).toEqual({ first: true });
		expect(current?.version).toBe(1);
	});

	it('says a deleted table is gone, not merely contended', async () => {
		const row = await make();
		await deleteCardTable(db, row.id, owner);
		expect(await saveTableState(db, row.id, 0, {}, 5)).toEqual({ ok: false, reason: 'gone' });
	});

	it('keeps a table alive by being used', async () => {
		const row = await make();
		await touchCardTable(db, row.id, Date.now() - 60_000);
		const before = (await getCardTable(db, row.id))!.lastActiveAt.getTime();
		await saveTableState(db, row.id, 0, {}, 5);
		expect((await getCardTable(db, row.id))!.lastActiveAt.getTime()).toBeGreaterThan(before);
	});

	it('cannot write an expired table back to life', async () => {
		const row = await make();
		await touchCardTable(db, row.id, Date.now() - TABLE_RETENTION_MS - 1000);
		// Every read path already treats this table as gone; a client still
		// holding its id and version must not be able to resurrect it.
		expect(await saveTableState(db, row.id, 0, { sneaky: true }, 5)).toEqual({
			ok: false,
			reason: 'expired'
		});
	});

	it('counts each command once, however many land', async () => {
		const row = await make();
		let version = 0;
		for (let i = 0; i < 5; i++) {
			const saved = await saveTableState(db, row.id, version, { i }, 5);
			if (!saved.ok) throw new Error(saved.reason);
			version = saved.table.version;
		}
		const current = await getCardTable(db, row.id);
		expect(current?.version).toBe(5);
		expect(current?.commandCount).toBe(5);
	});
});

describe('seats', () => {
	it('start empty and come back in the order they sat down', async () => {
		const row = await make();
		expect(await listSeats(db, row.id)).toEqual([]);
		await db.insert(schema.cardTableSeats).values({ tableId: row.id, name: 'First' });
		await db.insert(schema.cardTableSeats).values({ tableId: row.id, name: 'Second' });
		expect((await listSeats(db, row.id)).map((s) => s.name)).toEqual(['First', 'Second']);
	});

	it('may be held by nobody in particular — the point of a guest seat', async () => {
		const row = await make();
		const [seat] = await db
			.insert(schema.cardTableSeats)
			.values({ tableId: row.id, name: 'Grimwold' })
			.returning();
		expect(seat.userId).toBeNull();
		expect(seat.status).toBe('pending');
		expect(seat.isGm).toBe(false);
	});
});
