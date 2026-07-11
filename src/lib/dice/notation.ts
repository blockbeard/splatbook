/**
 * Dice notation — parsing `XdY±mod` into a structured spec, and formatting a
 * spec back to canonical notation. Pure and game-agnostic: this is shell dice
 * infrastructure (see `architecture.md`), the generic core the per-game presets
 * and the roll function build on. No randomness here — parsing only.
 *
 * Grammar (whitespace and letter case are ignored):
 *
 *   spec    := term ( sign term )*
 *   term    := dice | integer            // dice: `XdY` or `dY` (X defaults to 1)
 *   sign    := '+' | '-'
 *
 * A spec must contain at least one dice term (`3` alone is not a roll). Dice
 * terms are only ever added — `2d6-1d4` is rejected, because "subtract a die" is
 * not a thing; flat integers may be added or subtracted (`2d6+1`, `1d20-2`).
 * Multiple dice terms of different sizes are fine (`2d6+1d4+1`).
 */

/** One dice term: `count` dice of `sides` faces each. Both are ≥ 1. */
export interface DiceTerm {
	count: number;
	sides: number;
}

/** A parsed dice expression: its dice terms plus a single summed flat modifier. */
export interface DiceSpec {
	terms: DiceTerm[];
	/** Net flat modifier (all bare integers summed, honouring their signs). */
	modifier: number;
	/** Canonical notation for the spec, e.g. `2d6+1` (see `formatSpec`). */
	notation: string;
}

/** Format terms + modifier as canonical notation (`2d6+1d4-1`). The modifier is
 * omitted when zero; a negative modifier keeps its sign. */
export function formatSpec(terms: readonly DiceTerm[], modifier: number): string {
	const dice = terms.map((t) => `${t.count}d${t.sides}`).join('+');
	if (modifier > 0) return `${dice}+${modifier}`;
	if (modifier < 0) return `${dice}${modifier}`; // Number already carries the '-'
	return dice;
}

// One token = optional leading sign, then either a dice group (`2d6`, `d20`) or a
// bare integer. Anchored walking (see `parseNotation`) rejects anything the
// tokens don't cover, so a stray character can't be silently ignored.
const TOKEN = /([+-]?)(\d*d\d+|\d+)/giy;

/**
 * Parse dice notation into a {@link DiceSpec}. Throws a descriptive `Error` on
 * anything malformed — an empty string, a gap the grammar doesn't cover, a
 * subtracted die, or a zero-sided die — so callers can surface the message and
 * the roll function can trust its input. Use {@link isValidNotation} to probe
 * without catching.
 */
export function parseNotation(input: string): DiceSpec {
	const raw = input.trim();
	if (raw === '') throw new Error('Empty dice notation.');
	const compact = raw.replace(/\s+/g, '');

	const terms: DiceTerm[] = [];
	let modifier = 0;
	let cursor = 0;
	TOKEN.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = TOKEN.exec(compact)) !== null) {
		cursor = TOKEN.lastIndex;
		const sign = m[1] === '-' ? -1 : 1;
		const body = m[2];
		const dAt = body.search(/d/i);
		if (dAt === -1) {
			modifier += sign * Number(body);
			continue;
		}
		if (sign < 0) throw new Error(`Dice terms cannot be subtracted: ${raw}`);
		const count = dAt === 0 ? 1 : Number(body.slice(0, dAt));
		const sides = Number(body.slice(dAt + 1));
		if (count < 1) throw new Error(`A dice term needs at least one die: ${raw}`);
		if (sides < 1) throw new Error(`A die needs at least one side: ${raw}`);
		terms.push({ count, sides });
	}

	if (cursor !== compact.length) throw new Error(`Invalid dice notation: ${raw}`);
	if (terms.length === 0) throw new Error(`Dice notation needs at least one die: ${raw}`);
	return { terms, modifier, notation: formatSpec(terms, modifier) };
}

/** Whether `input` is well-formed dice notation (a non-throwing probe over
 * {@link parseNotation}). */
export function isValidNotation(input: string): boolean {
	try {
		parseNotation(input);
		return true;
	} catch {
		return false;
	}
}
