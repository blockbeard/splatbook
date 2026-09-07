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
import { getCardTableByToken, touchCardTable, sweepExpiredTables } from '../db/card-tables';
import { listSeats } from '../db/card-tables';
import { resolveSeat } from '../db/card-table-seats';
import { applyCommand, eventsSince } from '../db/card-table-commands';
import { seededRng } from '$lib/games/hmtw/engine/shuffle';
import type { CardTableRow, CardTableSeat } from '../db/schema';
import type { SeatClaim } from '$lib/seat-claims';

/** A game that has a table, or nothing. */
export function cardTableOf(gameId: string): CardTableModule | undefined {
	return getGame(gameId)?.cardTable;
}

/**
 * Load a game's pack files for its table.
 *
 * Takes the event's `fetch` so the same code runs on node and on Workers, the
 * way the PDF endpoint already does.
 */
export async function loadPack(
	fetchFn: typeof fetch,
	gameId: string,
	files: readonly string[]
): Promise<Record<string, unknown>> {
	const entries = await Promise.all(
		files.map(async (file) => {
			const res = await fetchFn(`/content-packs/${gameId}/${file}`);
			if (!res.ok) throw new Error(`pack file missing: ${gameId}/${file}`);
			return [file, await res.json()] as const;
		})
	);
	return Object.fromEntries(entries);
}

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
}

export async function viewFor(db: Db, ctx: TableContext, sinceVersion: number): Promise<TableView> {
	const events = await eventsSince(db, ctx.row.id, sinceVersion);
	return {
		version: ctx.row.version,
		state: ctx.module.project(ctx.state, ctx.seat?.id ?? null),
		events: events.map((e) => ({ version: e.version, kind: e.kind, data: e.data })),
		seatId: ctx.seat?.id ?? null
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
	requestHash: string
) {
	return applyCommand(
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
			return ctx.module.reduce(synced, command, {
				actorSeatId: ctx.seat?.id ?? null,
				rng: seededRng(crypto.getRandomValues(new Uint32Array(1))[0])
			});
		}
	);
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
