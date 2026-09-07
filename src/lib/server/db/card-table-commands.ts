/**
 * Applying a command to a card table, and reading back what happened.
 *
 * The shell owns the mechanism — versions, idempotency, the log — and knows
 * nothing about cards. The game supplies two functions and the shell calls
 * them: one that turns a command into a new state, and one that turns a state
 * into the view a given seat may have. Neither is inspected.
 *
 * **How the sync channel stays safe.** An earlier draft of the plan had clients
 * replaying a stream of commands, which meant every command needed its own
 * per-seat projection and a table of per-recipient secrets — a second way out
 * of the building, guarded separately from the first. Syncing projected *state*
 * instead removed the problem rather than defending it: private facts travel
 * only through the game's projection, which has its own leak tests, and the
 * event log carries public facts alone. "Seat 3 drew four cards", never which
 * four. One surface to hold correct instead of two.
 *
 * Server-only.
 */

import { and, asc, eq, gt } from 'drizzle-orm';
import type { Db } from './entities.ts';
import { cardTableEvents, type CardTableEvent, type CardTableRow } from './schema.ts';
import { getCardTable, saveTableState, type SaveRefusal } from './card-tables.ts';

/**
 * What a game's reducer hands back: the state after the command, and the public
 * fact to log about it.
 *
 * Refusing is allowed but rare by design — the table is permissive, so a
 * refusal here means the impossible (no such zone) or the unsafe (a card named
 * in a hand that is not yours), never the merely illegal.
 */
export type CommandOutcome =
	| { ok: true; state: unknown; stateVersion: number; kind: string; data?: unknown }
	| { ok: false; reason: string };

export type ApplyRefusal = SaveRefusal | 'no-such-table' | 'rejected';

export type ApplyResult =
	| { ok: true; table: CardTableRow; event: CardTableEvent; replayed: boolean }
	| { ok: false; reason: ApplyRefusal; detail?: string };

export interface ApplyCommandInput {
	tableId: string;
	/** Which seat is asking. Null for something the table does to itself. */
	actorSeatId: string | null;
	/** The version the client believed it was working from. */
	expectedVersion: number;
	/**
	 * Stable across retries of the same command and different for a new one.
	 * The unique index does the enforcing; this is only the key.
	 */
	requestHash: string;
}

/**
 * Run one command against a table.
 *
 * The order matters. Idempotency is checked first, so a client that retried
 * after a dropped response gets the original answer rather than playing the
 * card twice. Then the reducer runs on the current state, then the write goes
 * in against the expected version — and if somebody else got there first, the
 * write is refused and nothing was changed, because the reducer is pure and its
 * result is simply discarded.
 */
export async function applyCommand(
	db: Db,
	input: ApplyCommandInput,
	reduce: (state: unknown) => CommandOutcome
): Promise<ApplyResult> {
	const replayed = await findByRequest(db, input.tableId, input.requestHash);
	if (replayed) {
		const table = await getCardTable(db, input.tableId);
		if (table) return { ok: true, table, event: replayed, replayed: true };
	}

	const table = await getCardTable(db, input.tableId);
	if (!table) return { ok: false, reason: 'no-such-table' };

	const outcome = reduce(table.state);
	if (!outcome.ok) return { ok: false, reason: 'rejected', detail: outcome.reason };

	const saved = await saveTableState(
		db,
		input.tableId,
		input.expectedVersion,
		outcome.state,
		outcome.stateVersion
	);
	if (!saved.ok) return { ok: false, reason: saved.reason };

	// The event's version is the version the write produced, so a client's
	// cursor is simply the version it already holds — one counter, not two.
	const [event] = await db
		.insert(cardTableEvents)
		.values({
			tableId: input.tableId,
			version: saved.table.version,
			actorSeatId: input.actorSeatId,
			kind: outcome.kind,
			data: outcome.data ?? {},
			requestHash: input.requestHash
		})
		.returning();

	return { ok: true, table: saved.table, event, replayed: false };
}

/** The event a given request already produced, if it has run before. */
export async function findByRequest(
	db: Db,
	tableId: string,
	requestHash: string
): Promise<CardTableEvent | undefined> {
	const [row] = await db
		.select()
		.from(cardTableEvents)
		.where(and(eq(cardTableEvents.tableId, tableId), eq(cardTableEvents.requestHash, requestHash)))
		.limit(1);
	return row;
}

/**
 * Events after a client's cursor, oldest first.
 *
 * Capped, because a client returning to a long-running table should be given
 * the current state and the recent past rather than an afternoon of history it
 * cannot use.
 */
export async function eventsSince(
	db: Db,
	tableId: string,
	sinceVersion: number,
	limit = 50
): Promise<CardTableEvent[]> {
	return db
		.select()
		.from(cardTableEvents)
		.where(and(eq(cardTableEvents.tableId, tableId), gt(cardTableEvents.version, sinceVersion)))
		.orderBy(asc(cardTableEvents.version))
		.limit(limit);
}
