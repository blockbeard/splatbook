/**
 * Card-table persistence (phase 29) — create, find, and tidy the shared
 * surfaces a game contributes.
 *
 * Shaped like the campaign service and for the same reasons: it takes the
 * drizzle `db` first so tests can drive it against an in-memory database, and
 * access control lives here in the WHERE clauses rather than in the routes.
 *
 * Two things differ from campaigns, both deliberate. A table is found by a
 * **token in its URL** rather than by membership, because the people who need
 * to reach it may have no account. And creating one **requires an account**,
 * which is the whole of the abuse story: it removes the only unbounded
 * anonymous write endpoint, and everything left is bounded by the seats a table
 * can hold.
 *
 * `state` is the game's own blob and is never inspected here — the same
 * treatment `entities.data` gets.
 *
 * Server-only.
 */

import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { Db } from './entities.ts';
import { cardTables, cardTableSeats, type CardTableRow, type CardTableSeat } from './schema.ts';

/** Six weeks, in milliseconds — the retention window, matching Crawlspace. */
export const TABLE_RETENTION_MS = 42 * 24 * 60 * 60 * 1000;

export interface NewCardTableInput {
	gameId: string;
	name: string;
	/** The creator. Sign-in is required precisely here and nowhere else. */
	ownerId: string;
	/** The game's opening table state, opaque to this layer. */
	state: unknown;
	/** The game's own schema version for that blob. */
	stateVersion: number;
}

/** Create a table. Its room token is generated for it and goes in the URL. */
export async function createCardTable(db: Db, input: NewCardTableInput): Promise<CardTableRow> {
	const [row] = await db
		.insert(cardTables)
		.values({
			gameId: input.gameId,
			name: input.name,
			ownerId: input.ownerId,
			state: input.state,
			stateVersion: input.stateVersion
		})
		.returning();
	return row;
}

/** Whether a table has fallen outside the retention window. */
export const isExpired = (row: CardTableRow, now: number = Date.now()): boolean =>
	now - row.lastActiveAt.getTime() > TABLE_RETENTION_MS;

/** Find a table by id. */
export async function getCardTable(db: Db, id: string): Promise<CardTableRow | undefined> {
	const [row] = await db.select().from(cardTables).where(eq(cardTables.id, id)).limit(1);
	return row;
}

/**
 * Find a table by the token in its URL — the lookup that works for someone with
 * no account, which is most of the people who will use one.
 *
 * An expired table reads as **absent**, which is what keeps the retention
 * promise, and this function does **not** delete it. That separation is
 * deliberate and load-bearing: the sync loop polls this path about once a second
 * per client, and a read that writes would turn a quiet table into a steady
 * stream of billed writes on D1 — the opposite of the read budget this phase
 * went to some trouble over. Removing the row is `sweepExpiredTables`'s job,
 * called from page loads and never from a poll.
 */
export async function getCardTableByToken(
	db: Db,
	token: string,
	now: number = Date.now()
): Promise<CardTableRow | undefined> {
	const [row] = await db.select().from(cardTables).where(eq(cardTables.roomToken, token)).limit(1);
	if (!row || isExpired(row, now)) return undefined;
	return row;
}

/** The tables a user created, newest first. */
export async function listCardTablesForOwner(db: Db, ownerId: string): Promise<CardTableRow[]> {
	return db
		.select()
		.from(cardTables)
		.where(eq(cardTables.ownerId, ownerId))
		.orderBy(desc(cardTables.lastActiveAt));
}

/**
 * Mark a table as still in use, which is what keeps it alive. Called on any
 * read or write that a person caused — not on a poll, or a table would never
 * expire while a forgotten browser tab sat open on it.
 */
export async function touchCardTable(db: Db, id: string, now: number = Date.now()): Promise<void> {
	await db
		.update(cardTables)
		.set({ lastActiveAt: new Date(now) })
		.where(eq(cardTables.id, id));
}

/**
 * Replace the room token, revoking every outstanding link.
 *
 * Owner-guarded. Seats are not accounts, so this is the only way to shut a
 * table to someone who should no longer be at it.
 */
export async function rotateRoomToken(
	db: Db,
	id: string,
	ownerId: string
): Promise<CardTableRow | undefined> {
	const [row] = await db
		.update(cardTables)
		.set({ roomToken: crypto.randomUUID() })
		.where(and(eq(cardTables.id, id), eq(cardTables.ownerId, ownerId)))
		.returning();
	return row;
}

/**
 * Delete a table and everything at it.
 *
 * Owner-guarded, and the practical deletion route for a guest: they have no
 * account for an erasure request to name them by, so the answer to "take my
 * name off that table" is the GM removing the table, which is immediate and
 * needs no correspondence.
 */
export async function deleteCardTable(db: Db, id: string, ownerId: string): Promise<boolean> {
	const rows = await db
		.delete(cardTables)
		.where(and(eq(cardTables.id, id), eq(cardTables.ownerId, ownerId)))
		.returning();
	return rows.length > 0;
}

/**
 * Retire a bounded number of tables nobody has come back to.
 *
 * Expiry on access alone never reaches a table nobody revisits, which would
 * make "kept for six weeks" a claim the mechanism could not keep. So a page load
 * sweeps a few stale ones on its way past.
 *
 * **Page loads only — never a poll.** This deletes, and the sync loop asks for a
 * table roughly once a second per client; hanging writes off that path would
 * cost more than the whole feature is worth. Bounded for the same reason: it
 * rides along with a request somebody is already waiting on.
 */
export async function sweepExpiredTables(
	db: Db,
	limit = 5,
	now: number = Date.now()
): Promise<number> {
	const stale = await db
		.select({ id: cardTables.id })
		.from(cardTables)
		.where(lt(cardTables.lastActiveAt, new Date(now - TABLE_RETENTION_MS)))
		.orderBy(asc(cardTables.lastActiveAt))
		.limit(limit);
	for (const row of stale) await db.delete(cardTables).where(eq(cardTables.id, row.id));
	return stale.length;
}

/** The seats at a table, oldest first — the order they sat down. */
export async function listSeats(db: Db, tableId: string): Promise<CardTableSeat[]> {
	return db
		.select()
		.from(cardTableSeats)
		.where(eq(cardTableSeats.tableId, tableId))
		.orderBy(asc(cardTableSeats.createdAt));
}

/**
 * Persist a new state blob, bumping the version.
 *
 * The version is the optimistic-concurrency counter: a caller passes the
 * version it believed it was working from, and a write against a stale version
 * fails rather than clobbering whoever got there first. That is the whole
 * mechanism behind "someone got there first" being the only refusal this design
 * has, and it is enforced by the WHERE clause rather than by a read-then-write.
 */
export async function saveTableState(
	db: Db,
	id: string,
	expectedVersion: number,
	state: unknown,
	stateVersion: number,
	now: number = Date.now()
): Promise<CardTableRow | undefined> {
	const [row] = await db
		.update(cardTables)
		.set({
			state,
			stateVersion,
			version: expectedVersion + 1,
			// Incremented in SQL rather than read-then-written, so two commands
			// landing together cannot both write the same count back.
			commandCount: sql`${cardTables.commandCount} + 1`,
			lastActiveAt: new Date(now)
		})
		.where(
			and(
				eq(cardTables.id, id),
				eq(cardTables.version, expectedVersion),
				// An expired table cannot be written back to life. Without this, a
				// client holding an id and a version could resurrect a table every
				// read path already treats as gone.
				gte(cardTables.lastActiveAt, new Date(now - TABLE_RETENTION_MS))
			)
		)
		.returning();
	return row;
}
