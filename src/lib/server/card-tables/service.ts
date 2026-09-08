/**
 * The shell's card-table service: everything a route needs, in one place.
 *
 * This is where the shell's half and the game's half meet. The shell resolves
 * the table, the seat and the version; the game creates, migrates, reduces and
 * projects. Neither reaches past the `cardTable` slot, which is the only door
 * between them.
 *
 * Server-only.
 */

import type { Db } from '../db/entities';
import type { CardTableModule } from '$lib/games/types';
import { getGame } from '$lib/games';
import {
	expireByToken,
	getCardTableByToken,
	touchCardTable,
	sweepExpiredTables
} from '../db/card-tables';
import { listSeats } from '../db/card-tables';
import { resolveSeat } from '../db/card-table-seats';
import { applyCommand, eventsSince } from '../db/card-table-commands';
/**
 * Randomness for a shuffle, straight from the platform.
 *
 * The plan called for a *seeded* generator, and the reasoning behind that word
 * was determinism in tests and keeping the order on the server. Production
 * needs only the second. Seeding from a single 32-bit value would have made
 * this strictly worse than it looks: a tarot deck has 57! orderings and a
 * 32-bit seed can reach about four billion of them, so almost every possible
 * shuffle would have been unreachable. Tests still inject `seededRng`, where
 * repeatability is the whole point.
 */
const cryptoRng = (): number => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
import type { CardTableRow, CardTableSeat } from '../db/schema';
import type { SeatClaim } from '$lib/seat-claims';

/** A game that has a table, or nothing. */
export function cardTableOf(gameId: string): CardTableModule | undefined {
	return getGame(gameId)?.cardTable;
}

/**
 * Parsed pack files, kept for the life of the process (or the isolate).
 *
 * Pack files are static and immutable for a deployment, and a table's busiest
 * path fetches them on every request. Without this, one command meant four HTTP
 * round trips for content that cannot have changed — on Workers, four
 * subrequests against a fixed budget, for nothing. A deploy replaces the
 * process, so there is no staleness to manage.
 */
const packCache = new Map<string, Promise<unknown>>();

/**
 * Load a game's pack files for its table.
 *
 * Takes the event's `fetch` so the same code runs on node and on Workers, the
 * way the PDF endpoint already does. The promise is cached rather than the
 * value, so simultaneous first requests share one fetch instead of racing.
 */
export async function loadPack(
	fetchFn: typeof fetch,
	gameId: string,
	files: readonly string[]
): Promise<Record<string, unknown>> {
	const entries = await Promise.all(
		files.map(async (file) => {
			const key = `${gameId}/${file}`;
			let pending = packCache.get(key);
			if (!pending) {
				pending = fetchFn(`/content-packs/${key}`).then((res) => {
					if (!res.ok) throw new Error(`pack file missing: ${key}`);
					return res.json();
				});
				// A failed fetch must not be remembered as the answer forever.
				pending.catch(() => packCache.delete(key));
				packCache.set(key, pending);
			}
			return [file, await pending] as const;
		})
	);
	return Object.fromEntries(entries);
}

/** Drop the cache. For tests, which serve different packs from one process. */
export const clearPackCache = (): void => void packCache.clear();

export interface TableContext {
	row: CardTableRow;
	module: CardTableModule;
	pack: Record<string, unknown>;
	seats: CardTableSeat[];
	/** The seat this request holds, if any. */
	seat: CardTableSeat | undefined;
	/** The engine state, migrated and with its seats reconciled. */
	state: unknown;
	stateVersion: number;
}

/**
 * Resolve everything a request needs about a table, from its room token.
 *
 * Returns nothing for a token that names no table, or one that has expired —
 * expiry is a read-time judgement rather than a scheduled deletion, so the poll
 * path never writes.
 */
export async function loadTable(
	db: Db,
	fetchFn: typeof fetch,
	token: string,
	claim: SeatClaim | undefined,
	userId: string | undefined
): Promise<TableContext | undefined> {
	const row = await getCardTableByToken(db, token);
	if (!row) return undefined;

	const module = cardTableOf(row.gameId);
	if (!module) return undefined;

	const pack = await loadPack(fetchFn, row.gameId, module.packFiles);
	const migrated = module.migrate(row.state, pack);
	const seats = await listSeats(db, row.id);
	const admitted = seats
		.filter((s) => s.status === 'admitted')
		.map((s) => ({ id: s.id, isGm: s.isGm }));

	return {
		row,
		module,
		pack,
		seats,
		seat: await resolveSeat(db, row.id, claim, userId),
		state: module.syncSeats(migrated.state, admitted),
		stateVersion: migrated.stateVersion
	};
}

/** What a client is handed: the version, its own view, and public history. */
export interface TableView {
	version: number;
	state: unknown;
	events: { version: number; kind: string; data: unknown }[];
	/** The viewer's own seat id, or null. */
	seatId: string | null;
	/**
	 * Who is here and who is waiting.
	 *
	 * Carried on every poll rather than only in the page load, because the
	 * roster changes without the table's version moving: somebody asking for a
	 * seat writes no card. Leaving it to the page load meant a GM never saw a
	 * join request arrive — the one person who has to act on it — until they
	 * happened to reload.
	 */
	seats: { id: string; name: string; status: string; isGm: boolean }[];
}

export async function viewFor(db: Db, ctx: TableContext, sinceVersion: number): Promise<TableView> {
	const events = await eventsSince(db, ctx.row.id, sinceVersion);
	return {
		version: ctx.row.version,
		state: ctx.module.project(ctx.state, ctx.seat?.id ?? null),
		events: events.map((e) => ({ version: e.version, kind: e.kind, data: e.data })),
		seatId: ctx.seat?.id ?? null,
		seats: ctx.seats.map((s) => ({ id: s.id, name: s.name, status: s.status, isGm: s.isGm }))
	};
}

/**
 * Run a command, then hand back the fresh view.
 *
 * The randomness is made here, seeded from the platform's own generator, so a
 * shuffle's order is decided on the server and never travels.
 */
export async function runCommand(
	db: Db,
	ctx: TableContext,
	command: unknown,
	expectedVersion: number,
	requestHash: string,
	/** Injectable for tests; production takes the platform's own randomness. */
	rng?: () => number
) {
	let applied: unknown;
	const result = await applyCommand(
		db,
		{
			tableId: ctx.row.id,
			actorSeatId: ctx.seat?.id ?? null,
			expectedVersion,
			requestHash
		},
		(stored) => {
			// Reduce from the *stored* state migrated and seat-reconciled, so a
			// command never lands on a shape the game has not seen.
			const migrated = ctx.module.migrate(stored, ctx.pack);
			const admitted = ctx.seats
				.filter((s) => s.status === 'admitted')
				.map((s) => ({ id: s.id, isGm: s.isGm }));
			const synced = ctx.module.syncSeats(migrated.state, admitted);
			const outcome = ctx.module.reduce(synced, command, {
				actorSeatId: ctx.seat?.id ?? null,
				rng: rng ?? cryptoRng
			});
			// Kept so the caller can render the result without loading the whole
			// table again; discarded along with everything else if the write loses.
			if (outcome.ok) applied = outcome.state;
			return outcome;
		}
	);
	return result.ok ? { ...result, state: applied } : result;
}

/**
 * Mark a table as still in use and retire a few nobody came back to.
 *
 * **Page loads only.** Both of these write, and the sync loop asks about a
 * table once a second per client; hanging writes off that path would cost more
 * than the feature is worth.
 */
export async function touchOnPageLoad(db: Db, tableId: string): Promise<void> {
	await touchCardTable(db, tableId);
	await sweepExpiredTables(db);
}

/**
 * Retire a table whose token has just failed to resolve, and sweep a few more.
 *
 * The other half of `touchOnPageLoad`: somebody followed a link to a table that
 * has aged out, which is the earliest anyone will ever know it is gone. Doing
 * the delete here means the commonest way a stale table is *found* is also the
 * way it goes, rather than waiting for the global sweep to reach it.
 *
 * Safe for a token that names nothing: that costs one select and no writes.
 */
export async function retireOnMiss(db: Db, token: string): Promise<void> {
	await expireByToken(db, token);
	await sweepExpiredTables(db);
}

/**
 * The sweep on its own, for a page load that has no table in hand.
 *
 * Retention that only ran when somebody opened a table page depended on
 * somebody still holding a room link — precisely what a forgotten table does
 * not have. An owner's own listing is the page they do open, so it pays the
 * same small toll on the way past.
 */
export async function sweepOnPageLoad(db: Db): Promise<void> {
	await sweepExpiredTables(db);
}
