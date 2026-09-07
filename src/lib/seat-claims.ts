/**
 * Seat claim tickets, as they travel in a cookie.
 *
 * A single cookie carries every table this browser holds a seat at, because a
 * cookie per table would leak how many tables somebody is at to every request
 * on the site and would eventually hit a header limit.
 *
 * Pure parsing and formatting — no database, no framework — so the hook that
 * runs on *every* request site-wide can use it without touching either.
 */

/** The cookie's name. Scoped to the site, not to a table. */
export const SEAT_COOKIE = 'sb_seats';

export interface SeatClaim {
	seatId: string;
	secret: string;
}

/** Table id → the claim this browser holds for it. */
export type SeatClaims = Record<string, SeatClaim>;

/**
 * Parse the cookie. Anything malformed is dropped rather than throwing: a
 * mangled cookie should cost somebody their seat, not the whole page.
 */
export function parseSeatClaims(raw: string | undefined): SeatClaims {
	if (!raw) return {};
	const claims: SeatClaims = {};
	for (const entry of raw.split(' ')) {
		const [tableId, seatId, secret] = entry.split('.');
		if (tableId && seatId && secret) claims[tableId] = { seatId, secret };
	}
	return claims;
}

/** Format claims back into the cookie's value. */
export function formatSeatClaims(claims: SeatClaims): string {
	return Object.entries(claims)
		.map(([tableId, c]) => `${tableId}.${c.seatId}.${c.secret}`)
		.join(' ');
}

/** The claims with one table's seat replaced. */
export const withSeatClaim = (
	claims: SeatClaims,
	tableId: string,
	claim: SeatClaim
): SeatClaims => ({
	...claims,
	[tableId]: claim
});

/**
 * Cookie attributes.
 *
 * `httpOnly` because nothing in the browser needs to read this — it is proof
 * for the server, and script that cannot see it cannot leak it. `sameSite:
 * 'lax'` rather than `'none'`: the table is not embedded anywhere today, and
 * `'none'` would hand the ticket to any site that framed us. A year is longer
 * than the six-week retention window, so the cookie always outlives the table
 * it refers to rather than the other way round.
 */
export const SEAT_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	maxAge: 60 * 60 * 24 * 365
} as const;
