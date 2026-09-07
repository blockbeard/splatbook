/**
 * What bounds a card table.
 *
 * Shared rather than server-only, because the polling policy at the bottom is
 * the client's half of the same problem: the limits keep a table from growing
 * without end, and the cadence keeps a quiet one from costing anything to sit
 * at.
 *
 * The numbers exist because this feature has an unauthenticated write path by
 * design — someone with a room link can ask for a seat without an account, and
 * that is the point. Creating a *table* needs an account, which removes the
 * unbounded case; these cap what is left.
 */

/**
 * Seats that may be sitting at once. Five players and a GM, matching what the
 * book assumes and what Crawlspace allows.
 *
 * A shell constant for now. If a second game ever contributes a table with a
 * different shape, this becomes something the game supplies through its
 * `cardTable` slot — the same way every other game-specific number in this
 * project ended up in a pack.
 */
export const MAX_SEATS_PER_TABLE = 6;

/**
 * Seat requests that may be waiting for the GM at once.
 *
 * This is the one that matters for abuse: anybody holding a room token can ask
 * for a seat, and without a ceiling those rows pile up unbounded. Ten is far
 * more than a real table sees — the GM admits people within seconds, because
 * everyone is on a call — and small enough that filling it is pointless.
 */
export const MAX_PENDING_SEATS = 10;

/**
 * Commands one table will accept in its life.
 *
 * A very long session is a few thousand card moves. A hundred thousand is
 * unreachable by play and reachable by a script, so it separates the two
 * without anybody at a table ever meeting it.
 */
export const MAX_COMMANDS_PER_TABLE = 100_000;

/**
 * Tables one account may have at once.
 *
 * Sign-in makes creation attributable rather than free, but not free of limit:
 * an account is cheap to get. Expired tables stop counting, so this is a cap on
 * live tables rather than on a lifetime.
 */
export const MAX_TABLES_PER_OWNER = 25;

/** Longest a name may be. Long enough for any adventurer, short enough to store. */
export const MAX_SEAT_NAME_LENGTH = 60;

export interface PollState {
	/** The tab is not on screen. */
	hidden: boolean;
	/** A Challenge is running, where latency is most visible. */
	busy: boolean;
	/** How long since the table last changed. */
	quietMs: number;
}

/** Fastest and slowest this will ever ask. */
export const POLL_BUSY_MS = 1000;
export const POLL_IDLE_MS = 3000;
export const POLL_MAX_MS = 15000;

/**
 * How long to wait before asking the server again — or `null` for "do not ask".
 *
 * D1 bills per query rather than per byte, so the only levers that reduce cost
 * are how often a client asks and how many clients are asking. Reading fewer
 * columns saves nothing. Hence: a hidden tab asks nothing at all (the pattern
 * `RollLog.svelte` already uses), a Challenge is asked about every second
 * because that is where a beat of delay shows, everything else every three, and
 * a table nobody has touched backs off by doubling to a fifteen-second ceiling.
 *
 * Six clients at one second for a four-hour session is roughly 86,000 reads.
 * The backoff is what keeps a forgotten tab from costing that for a table
 * nobody is playing at.
 */
export function pollDelayMs(state: PollState): number | null {
	if (state.hidden) return null;
	const base = state.busy ? POLL_BUSY_MS : POLL_IDLE_MS;
	const doublings = Math.floor(Math.max(0, state.quietMs) / 60_000);
	return Math.min(POLL_MAX_MS, base * 2 ** Math.min(doublings, 10));
}
