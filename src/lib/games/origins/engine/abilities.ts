/**
 * Ability scores: the three generation methods, and the background's increases.
 *
 * Pure functions over the pack's `abilityGeneration` block — the standard
 * array, the point-buy budget and cost table, and the roll notation all come
 * from `origins-rules.json` rather than being constants here, so a table's
 * house-ruled variant is a pack edit.
 *
 * Every method gets a *validator*, not a warning: a builder that lets you
 * finish an illegal spread and then tells you about it on the sheet has failed
 * at the one job a builder has.
 */

import type { Ability, OriginsRules } from '../pack-schemas';
import { ABILITIES, type AbilityMap, type OriginsCharacter } from './character';

type Generation = OriginsRules['abilityGeneration'];

/** The 5e modifier: floor((score − 10) / 2). */
export function modifier(score: number): number {
	return Math.floor((score - 10) / 2);
}

/** A modifier as it is written on a sheet: "+2", "−1", "+0". */
export function formatModifier(mod: number): string {
	return mod < 0 ? `−${Math.abs(mod)}` : `+${mod}`;
}

/** The hard ceiling on a score at character creation, per the SRD's background
 * rules ("None of these increases can raise a score above 20"). */
export const MAX_SCORE = 20;

/**
 * A background's increases are legal if they are one +2 and one +1, or +1 to
 * each of three — always among the three abilities the background names.
 */
export function increasesAreLegal(
	increases: Partial<AbilityMap<number>>,
	offered: readonly Ability[]
): boolean {
	const entries = Object.entries(increases).filter(([, v]) => v && v > 0) as [Ability, number][];
	if (entries.some(([ability]) => !offered.includes(ability))) return false;
	const values = entries.map(([, v]) => v).sort((a, b) => b - a);
	const oneTwoOneOne = values.length === 2 && values[0] === 2 && values[1] === 1;
	const threeOnes = values.length === 3 && values.every((v) => v === 1);
	return oneTwoOneOne || threeOnes;
}

/** The two legal shapes, for a builder to offer as a choice. */
export const INCREASE_SPREADS = [
	{ id: '2-1', label: '+2 and +1', pattern: [2, 1] },
	{ id: '1-1-1', label: '+1 to all three', pattern: [1, 1, 1] }
] as const;

/** Final score = base + the background's increase, capped at 20. */
export function finalScore(base: number | null, increase = 0): number | null {
	if (base === null) return null;
	return Math.min(MAX_SCORE, base + increase);
}

/** All six final scores. Unassigned abilities stay null. */
export function finalScores(character: OriginsCharacter): AbilityMap<number | null> {
	const out = {} as AbilityMap<number | null>;
	for (const ability of ABILITIES) {
		out[ability] = finalScore(
			character.abilities.base[ability],
			character.abilities.increases[ability] ?? 0
		);
	}
	return out;
}

/** A final score's modifier, or 0 while the score is unassigned. */
export function abilityModifier(character: OriginsCharacter, ability: Ability): number {
	const score = finalScores(character)[ability];
	return score === null ? 0 : modifier(score);
}

// --- Standard array -------------------------------------------------------

/** The six assigned scores are exactly the standard array, in any order. */
export function standardArrayIsLegal(
	base: AbilityMap<number | null>,
	generation: Generation
): boolean {
	const assigned = ABILITIES.map((a) => base[a]);
	if (assigned.some((v) => v === null)) return false;
	const sort = (xs: number[]) => [...xs].sort((a, b) => b - a);
	return sort(assigned as number[]).join() === sort([...generation.standardArray]).join();
}

// --- Point buy ------------------------------------------------------------

/** What one score costs, or null if it is outside the buyable range. */
export function pointCost(score: number, generation: Generation): number | null {
	const cost = generation.pointBuy.costs[String(score)];
	return cost === undefined ? null : cost;
}

/** Points spent so far. Unassigned abilities cost nothing. */
export function pointsSpent(base: AbilityMap<number | null>, generation: Generation): number {
	let total = 0;
	for (const ability of ABILITIES) {
		const score = base[ability];
		if (score === null) continue;
		total += pointCost(score, generation) ?? 0;
	}
	return total;
}

/** Points still available. Negative means over budget. */
export function pointsRemaining(base: AbilityMap<number | null>, generation: Generation): number {
	return generation.pointBuy.budget - pointsSpent(base, generation);
}

/** Every score is buyable, all six are assigned, and the budget is not exceeded. */
export function pointBuyIsLegal(base: AbilityMap<number | null>, generation: Generation): boolean {
	for (const ability of ABILITIES) {
		const score = base[ability];
		if (score === null) return false;
		if (pointCost(score, generation) === null) return false;
	}
	return pointsRemaining(base, generation) >= 0;
}

// --- Rolling --------------------------------------------------------------

/**
 * Roll the pool the pack describes — 4d6 drop lowest, six times, by default.
 *
 * `rng` is injected so the builder can hand in the shell's dice and the tests
 * can hand in a sequence: an engine that reaches for `Math.random` itself is an
 * engine you cannot test.
 */
export function rollAbilityPool(generation: Generation, rng: () => number): number[] {
	const spec = generation.roll;
	const m = /^(\d+)d(\d+)$/.exec(spec.notation);
	if (!m) throw new Error(`unrecognised roll notation: ${spec.notation}`);
	const [count, sides] = [Number(m[1]), Number(m[2])];

	const pool: number[] = [];
	for (let i = 0; i < spec.count; i++) {
		const dice = Array.from({ length: count }, () => 1 + Math.floor(rng() * sides));
		dice.sort((a, b) => a - b);
		pool.push(dice.slice(spec.dropLowest).reduce((sum, d) => sum + d, 0));
	}
	return pool;
}

/** The assigned scores are exactly the rolled pool, in some order. */
export function rolledIsLegal(base: AbilityMap<number | null>, pool: readonly number[]): boolean {
	const assigned = ABILITIES.map((a) => base[a]);
	if (assigned.some((v) => v === null)) return false;
	if (pool.length !== ABILITIES.length) return false;
	const sort = (xs: number[]) => [...xs].sort((a, b) => b - a);
	return sort(assigned as number[]).join() === sort([...pool]).join();
}

// --- The one question the wizard actually asks -----------------------------

/** Are this character's base scores legal for the method it chose? */
export function baseScoresAreLegal(character: OriginsCharacter, rules: OriginsRules): boolean {
	const { method, base, rolled } = character.abilities;
	switch (method) {
		case 'standard-array':
			return standardArrayIsLegal(base, rules.abilityGeneration);
		case 'point-buy':
			return pointBuyIsLegal(base, rules.abilityGeneration);
		case 'roll':
			return rolledIsLegal(base, rolled);
		default:
			return false;
	}
}
