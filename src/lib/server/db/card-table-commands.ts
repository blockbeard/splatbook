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

/** A claimed-but-not-yet-finished event carries this instead of a version. */
const UNWRITTEN = 0;

/**
 * Run one command against a table.
 *
 * **The request hash is a lock, not a lookup.** Checking for a previous run and
 * then applying would leave a window: a client that retried the same command
 * with a refreshed version — which is exactly what a naive retry-on-conflict
 * loop does — could slip between another copy's check and its write, and the
 * command would apply twice. Two cards moved for one click.
 *
 * So the hash is *claimed* first, by inserting the event before the state is
 * written. The unique index makes that claim atomic without a transaction,
 * which matters because this codebase avoids them so the same code runs on
 * better-sqlite3 and on D1. Whoever wins the claim owns the command; whoever
 * loses is told to re-sync. If the write then fails, the claim is released so a
 * legitimate retry is not locked out by its own earlier attempt.
 */
export async function applyCommand(
	db: Db,
	input: ApplyCommandInput,
	reduce: (state: unknown) => CommandOutcome
): Promise<ApplyResult> {
	const table = await getCardTable(db, input.tableId);
	if (!table) return { ok: false, reason: 'no-such-table' };

	const existing = await findByRequest(db, input.tableId, input.requestHash);
	if (existing) return replayOf(table, existing);

	// Reduce before claiming: the reducer is pure, so a refusal costs nothing
	// and must not leave a claim behind.
	const outcome = reduce(table.state);
	if (!outcome.ok) return { ok: false, reason: 'rejected', detail: outcome.reason };

	let claim: CardTableEvent;
	try {
		[claim] = await db
			.insert(cardTableEvents)
			.values({
				tableId: input.tableId,
				version: UNWRITTEN,
				actorSeatId: input.actorSeatId,
				kind: outcome.kind,
				data: outcome.data ?? {},
				requestHash: input.requestHash
			})
			.returning();
	} catch {
		// Somebody else holds this command. Whatever they are doing with it, this
		// caller's answer is to look again rather than to apply it a second time.
		const theirs = await findByRequest(db, input.tableId, input.requestHash);
		return theirs ? replayOf(table, theirs) : { ok: false, reason: 'conflict' };
	}

	const saved = await saveTableState(
		db,
		input.tableId,
		input.expectedVersion,
		outcome.state,
		outcome.stateVersion
	);
	if (!saved.ok) {
		// Release the claim, or a client retrying after losing a race would find
		// its own abandoned attempt and believe the command had landed.
		await db.delete(cardTableEvents).where(eq(cardTableEvents.id, claim.id));
		return { ok: false, reason: saved.reason };
	}

	// The event's version is the version the write produced, so a client's
	// cursor is simply the version it already holds — one counter, not two.
	const [event] = await db
		.update(cardTableEvents)
		.set({ version: saved.table.version })
		.where(eq(cardTableEvents.id, claim.id))
		.returning();

	return { ok: true, table: saved.table, event, replayed: false };
}

/**
 * The answer for a command somebody has already run — or is still running.
 *
 * An event with no version yet is a claim in flight: its owner has not finished
 * writing, so there is no settled answer to give and the honest reply is that
 * this caller should re-sync.
 */
function replayOf(table: CardTableRow, event: CardTableEvent): ApplyResult {
	if (event.version === UNWRITTEN) return { ok: false, reason: 'conflict' };
	return { ok: true, table, event, replayed: true };
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
 * Claims in flight are excluded: an event with no version yet is a command
 * somebody is still writing, and it has no place in a client's history until
 * it lands.
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
		.where(
			and(
				eq(cardTableEvents.tableId, tableId),
				gt(cardTableEvents.version, Math.max(sinceVersion, UNWRITTEN))
			)
		)
		.orderBy(asc(cardTableEvents.version))
		.limit(limit);
}
