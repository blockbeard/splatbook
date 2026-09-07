/**
 * Seats at a card table (phase 29) — requesting one, being admitted to one, and
 * proving one is yours without an account.
 *
 * The identity model, and why it is shaped this way:
 *
 * **The seat is the identity; a cookie is only a claim ticket.** Private zones
 * are keyed to the seat row, never to whatever proved it last. So a player who
 * clears their cookies, switches device, or opens a private window has not lost
 * their hand — the GM re-seats them and the same row, with the same cards, gets
 * a fresh ticket. That is a test in this file rather than a hope.
 *
 * **A bearer secret against a stored hash, not a signed token.** The plan said
 * to sign with `AUTH_SECRET`; a stored hash turned out strictly better. It is
 * revocable — re-seating rotates it and the old ticket dies — and it does not
 * couple a table's seats to the lifetime of the app's auth secret, which would
 * have evicted every guest at every table the day that secret was rotated.
 *
 * **The room token is in the URL; the seat secret is not.** People share their
 * screen mid-game. A seat capability in the address bar is visible to everyone
 * on the call the moment somebody shares a tab, and taking a seat means seeing
 * a hand.
 *
 * Server-only.
 */

import { and, count, eq } from 'drizzle-orm';
import type { Db } from './entities.ts';
import { cardTableSeats, type CardTableSeat } from './schema.ts';
import {
	MAX_PENDING_SEATS,
	MAX_SEATS_PER_TABLE,
	MAX_SEAT_NAME_LENGTH
} from '../../card-table-limits.ts';

/** A seat plus the one-time secret its holder must keep. */
export interface SeatTicket {
	seat: CardTableSeat;
	/** Shown to its holder exactly once, then only ever compared as a hash. */
	secret: string;
}

/** Why a seat request was turned away, when it was. */
export type SeatRefusal =
	/** Every seat is taken. */
	| 'table-full'
	/** The GM has more people waiting than they are going to work through. */
	| 'too-many-waiting'
	/** A name that is empty, or longer than anything a person would type. */
	| 'bad-name';

export type SeatRequestResult =
	{ ok: true; ticket: SeatTicket } | { ok: false; reason: SeatRefusal };

/** How many seats are sitting, and how many are waiting. */
export async function seatCounts(
	db: Db,
	tableId: string
): Promise<{ admitted: number; pending: number }> {
	const rows = await db
		.select({ status: cardTableSeats.status, n: count() })
		.from(cardTableSeats)
		.where(eq(cardTableSeats.tableId, tableId))
		.groupBy(cardTableSeats.status);
	const of = (status: string) => rows.find((r) => r.status === status)?.n ?? 0;
	return { admitted: of('admitted'), pending: of('pending') };
}

/** SHA-256, via Web Crypto — the one implementation node and Workers share. */
async function hashSecret(secret: string): Promise<string> {
	const bytes = new TextEncoder().encode(secret);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const newSecret = (): string => crypto.randomUUID() + crypto.randomUUID();

/** The seat running the game, if anyone is. */
export async function gmSeatOf(db: Db, tableId: string): Promise<CardTableSeat | undefined> {
	const [row] = await db
		.select()
		.from(cardTableSeats)
		.where(
			and(
				eq(cardTableSeats.tableId, tableId),
				eq(cardTableSeats.isGm, true),
				eq(cardTableSeats.status, 'admitted')
			)
		)
		.limit(1);
	return row;
}

/**
 * Ask for a seat, giving the character's name.
 *
 * Admitted immediately when nobody is running the game yet, and pending
 * otherwise. That is not a convenience — with joins gated on a GM's approval,
 * a table whose first arrival had to wait for permission would have nobody able
 * to grant it, and the same deadlock returns every time a GM's seat falls
 * vacant. So the rule is: no GM, no gatekeeper.
 *
 * This is **the** unauthenticated write in the whole feature: anybody holding a
 * room token can call it, which is the point, so it is also the one that has to
 * be bounded. A full table takes nobody, a queue of waiting strangers stops
 * growing, and a name has to be a name.
 */
export async function requestSeat(
	db: Db,
	tableId: string,
	name: string,
	userId?: string
): Promise<SeatRequestResult> {
	const trimmed = name.trim();
	if (!trimmed || trimmed.length > MAX_SEAT_NAME_LENGTH) {
		return { ok: false, reason: 'bad-name' };
	}

	const counts = await seatCounts(db, tableId);
	if (counts.admitted >= MAX_SEATS_PER_TABLE) return { ok: false, reason: 'table-full' };
	if (counts.pending >= MAX_PENDING_SEATS) return { ok: false, reason: 'too-many-waiting' };

	const gm = await gmSeatOf(db, tableId);
	const secret = newSecret();
	const [seat] = await db
		.insert(cardTableSeats)
		.values({
			tableId,
			name: trimmed,
			userId: userId ?? null,
			claimSecret: await hashSecret(secret),
			status: gm ? 'pending' : 'admitted'
		})
		.returning();
	return { ok: true, ticket: { seat, secret } };
}

/**
 * Let a waiting seat sit down. Only the GM may, and only into a table with
 * room: the seat cap is checked here as well as at the request, because a
 * queue can outlive the space it was queuing for.
 */
export async function admitSeat(
	db: Db,
	tableId: string,
	seatId: string,
	bySeatId: string
): Promise<CardTableSeat | undefined> {
	const gm = await gmSeatOf(db, tableId);
	if (!gm || gm.id !== bySeatId) return undefined;
	const counts = await seatCounts(db, tableId);
	if (counts.admitted >= MAX_SEATS_PER_TABLE) return undefined;
	const [row] = await db
		.update(cardTableSeats)
		.set({ status: 'admitted' })
		.where(and(eq(cardTableSeats.id, seatId), eq(cardTableSeats.tableId, tableId)))
		.returning();
	return row;
}

/** Turn a waiting seat away, or remove one that is sitting. Only the GM may. */
export async function removeSeat(
	db: Db,
	tableId: string,
	seatId: string,
	bySeatId: string
): Promise<boolean> {
	const gm = await gmSeatOf(db, tableId);
	if (!gm || gm.id !== bySeatId) return false;
	const rows = await db
		.delete(cardTableSeats)
		.where(and(eq(cardTableSeats.id, seatId), eq(cardTableSeats.tableId, tableId)))
		.returning();
	return rows.length > 0;
}

/**
 * Take the GM seat, which anyone **already at the table** may do while it is
 * vacant.
 *
 * Load-bearing rather than convenient. Joins need a GM's approval, so a GM who
 * loses their cookie would otherwise lock out the whole table including
 * themselves: there would be nobody left who could re-admit anybody. A vacant
 * seat an admitted hand can pick up turns a table-ending failure into ten
 * awkward seconds.
 *
 * "Already at the table" is the important half, and an earlier version of this
 * function was missing it. A *pending* seat is somebody the GM has not let in —
 * often a stranger who found the room link. Letting one take the GM seat the
 * moment it fell vacant would have handed them the table, and with it the power
 * to admit whoever else they liked. Waiting on approval is not the same as
 * sitting down.
 *
 * That leaves no deadlock: if every remaining seat is pending, nobody claims
 * the seat, but the next person to arrive is admitted outright — because
 * `requestSeat` skips approval when there is no GM to ask — and they can.
 */
export async function claimGmSeat(
	db: Db,
	tableId: string,
	seatId: string
): Promise<CardTableSeat | undefined> {
	if (await gmSeatOf(db, tableId)) return undefined;
	const [row] = await db
		.update(cardTableSeats)
		.set({ isGm: true })
		.where(
			and(
				eq(cardTableSeats.id, seatId),
				eq(cardTableSeats.tableId, tableId),
				eq(cardTableSeats.status, 'admitted')
			)
		)
		.returning();
	return row;
}

/**
 * Step down, leaving the seat for someone else to pick up.
 *
 * `seatId` is the *caller's own* seat, as with every other guarded call here:
 * the `isGm` condition means a player passing somebody else's id changes
 * nothing, so a route that passes the resolved caller cannot be used to depose
 * a sitting GM.
 */
export async function vacateGmSeat(db: Db, tableId: string, seatId: string): Promise<boolean> {
	const rows = await db
		.update(cardTableSeats)
		.set({ isGm: false })
		.where(
			and(
				eq(cardTableSeats.id, seatId),
				eq(cardTableSeats.tableId, tableId),
				eq(cardTableSeats.isGm, true)
			)
		)
		.returning();
	return rows.length > 0;
}

/**
 * Hand a seat back to whoever lost their claim on it — a cleared cookie, a
 * different device, a private window.
 *
 * Only the GM may, which is what stops seat theft, and the seat row is
 * untouched but for its secret. Everything private to that seat is keyed to the
 * row, so the returning player finds their hand exactly as they left it.
 */
export async function reseat(
	db: Db,
	tableId: string,
	seatId: string,
	bySeatId: string
): Promise<SeatTicket | undefined> {
	const gm = await gmSeatOf(db, tableId);
	if (!gm || gm.id !== bySeatId) return undefined;
	const secret = newSecret();
	const [seat] = await db
		.update(cardTableSeats)
		.set({ claimSecret: await hashSecret(secret) })
		.where(and(eq(cardTableSeats.id, seatId), eq(cardTableSeats.tableId, tableId)))
		.returning();
	return seat ? { seat, secret } : undefined;
}

/**
 * Which seat, if any, this request is holding.
 *
 * A signed-in user is recognised by their account, so they keep their seat
 * across devices without a ticket at all. A guest presents seat id and secret,
 * and the secret is compared as a hash — the raw value is never stored, so a
 * leaked database is not a set of keys to every table.
 */
export async function resolveSeat(
	db: Db,
	tableId: string,
	claim: { seatId: string; secret: string } | undefined,
	userId?: string
): Promise<CardTableSeat | undefined> {
	if (userId) {
		const [byAccount] = await db
			.select()
			.from(cardTableSeats)
			.where(and(eq(cardTableSeats.tableId, tableId), eq(cardTableSeats.userId, userId)))
			.limit(1);
		if (byAccount) return byAccount;
	}
	if (!claim) return undefined;

	const [seat] = await db
		.select()
		.from(cardTableSeats)
		.where(and(eq(cardTableSeats.id, claim.seatId), eq(cardTableSeats.tableId, tableId)))
		.limit(1);
	if (!seat?.claimSecret) return undefined;
	return seat.claimSecret === (await hashSecret(claim.secret)) ? seat : undefined;
}
