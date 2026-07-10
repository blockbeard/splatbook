/**
 * Pure dice helpers for the GM guide's rollable tables (Die of Fate, weather).
 * No UI, no randomness baked in — `rollDie` takes an injectable `rng` so the
 * components stay pure-testable and the logic (range parsing, matching) is
 * unit-tested on its own.
 *
 * The GM playbook authors outcome rows against d6 ranges written as `"1"`,
 * `"2-3"`, `"4-6"`, etc. A roll matches a row when it falls in that row's range.
 */

/** An inclusive integer range, `min..max`. */
export interface DieRange {
	min: number;
	max: number;
}

/**
 * Parse a d6 range spec (`"4"`, `"2-3"`) into an inclusive range. A malformed or
 * empty spec yields an empty range (`min > max`) that matches nothing, so a
 * typo in the pack degrades to "no highlight" rather than throwing.
 */
export function parseRange(spec: string): DieRange {
	const m = spec.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
	if (!m) return { min: Number.NaN, max: Number.NaN };
	const min = Number(m[1]);
	const max = m[2] === undefined ? min : Number(m[2]);
	return { min: Math.min(min, max), max: Math.max(min, max) };
}

/** Whether `roll` falls within the row's range spec. */
export function rangeIncludes(spec: string, roll: number): boolean {
	const { min, max } = parseRange(spec);
	return roll >= min && roll <= max;
}

/** Roll a die with `sides` faces (default 6) using `rng` (default `Math.random`),
 * returning an integer in `1..sides`. */
export function rollDie(sides = 6, rng: () => number = Math.random): number {
	return Math.floor(rng() * sides) + 1;
}

/** Index of the first row whose range spec includes `roll`, or −1 if none. */
export function matchingRowIndex(specs: readonly string[], roll: number): number {
	return specs.findIndex((spec) => rangeIncludes(spec, roll));
}
