/**
 * Rolling dice — the generic core (`architecture.md`: shell dice infrastructure).
 * Randomness is injectable so every result is deterministically testable and the
 * engine stays pure: pass an `rng` returning a float in `[0, 1)`; it defaults to
 * `Math.random` only at the edge.
 *
 * Advantage / disadvantage is modelled the game-agnostic way that generalises the
 * familiar d20 rule: roll one **extra** die on each term and drop a die — the
 * lowest on advantage, the highest on disadvantage. For `1d20` that is exactly
 * "roll twice, keep the better"; for `2d6` it is "roll 3d6, keep the best two".
 * Dropped dice stay in the result (with `kept: false`) so a UI can show them
 * struck through. Flat modifiers are never dropped.
 */

import { parseNotation, type DiceSpec } from './notation';

/** A source of randomness: returns a float in `[0, 1)`, like `Math.random`. */
export type Rng = () => number;

/** How to roll: straight, or with an extra die kept best/worst per term. */
export type RollMode = 'normal' | 'advantage' | 'disadvantage';

/** One physical die in a roll's outcome. `kept` is false for a die dropped by
 * advantage/disadvantage — it doesn't count toward the total but is retained for
 * display. */
export interface DieRoll {
	sides: number;
	value: number;
	kept: boolean;
}

/** The outcome of a roll: the canonical notation, the mode, every die (kept and
 * dropped), the flat modifier, a separate ad hoc bonus, and the final total. */
export interface RollResult {
	notation: string;
	mode: RollMode;
	dice: DieRoll[];
	modifier: number;
	/**
	 * A one-off signed bonus dialled in at roll time (commit 107's bonus box) —
	 * kept apart from `modifier` (which comes from the notation itself, e.g. a
	 * stat) so the log can show where each part of the total came from: "2d6+1
	 * (bonus +2)" reads as stat +1, situational +2, rather than folding both
	 * into one number and losing which was which. Always present (0 when unused)
	 * so consumers never have to branch on its absence.
	 */
	bonus: number;
	total: number;
}

/** Roll a single die of `sides` faces, returning an integer in `1..sides`. */
export function rollDie(sides: number, rng: Rng = Math.random): number {
	return Math.floor(rng() * sides) + 1;
}

/** `+2` / `-2` / `+0` — a signed number as read aloud at the table. */
export function formatSigned(n: number): string {
	return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Roll a dice expression — a notation string (`"2d6+1"`) or an already-parsed
 * {@link DiceSpec}. Returns every die rolled plus the total. `opts.mode`
 * defaults to `'normal'`; `opts.rng` defaults to `Math.random`; `opts.bonus`
 * (default 0) adds to the total without touching `modifier` or `notation`.
 */
export function roll(
	input: string | DiceSpec,
	opts: { rng?: Rng; mode?: RollMode; bonus?: number } = {}
): RollResult {
	const spec = typeof input === 'string' ? parseNotation(input) : input;
	const rng = opts.rng ?? Math.random;
	const mode = opts.mode ?? 'normal';
	const bonus = opts.bonus ?? 0;
	const extra = mode === 'normal' ? 0 : 1;

	const dice: DieRoll[] = [];
	for (const term of spec.terms) {
		const rolled: DieRoll[] = Array.from({ length: term.count + extra }, () => ({
			sides: term.sides,
			value: rollDie(term.sides, rng),
			kept: true
		}));
		if (extra > 0) {
			// Drop the lowest on advantage, the highest on disadvantage. Sort a copy
			// so `dice` stays in roll order for display; mutate the chosen die's flag.
			const byValue = [...rolled].sort((a, b) => a.value - b.value);
			const drop = mode === 'advantage' ? byValue[0] : byValue[byValue.length - 1];
			drop.kept = false;
		}
		dice.push(...rolled);
	}

	const kept = dice.reduce((sum, d) => (d.kept ? sum + d.value : sum), 0);
	return {
		notation: spec.notation,
		mode,
		dice,
		modifier: spec.modifier,
		bonus,
		total: kept + spec.modifier + bonus
	};
}
