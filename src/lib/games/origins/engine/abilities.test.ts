import { describe, expect, it } from 'vitest';
import {
	baseScoresAreLegal,
	finalScore,
	formatModifier,
	increasesAreLegal,
	modifier,
	pointBuyIsLegal,
	pointCost,
	pointsRemaining,
	rollAbilityPool,
	rolledIsLegal,
	standardArrayIsLegal
} from './abilities';
import { createCharacter, type AbilityMap } from './character';
import { background, rules } from './fixtures';

const gen = rules.abilityGeneration;
const scores = (
	STR: number | null,
	DEX: number | null,
	CON: number | null,
	INT: number | null,
	WIS: number | null,
	CHA: number | null
): AbilityMap<number | null> => ({ STR, DEX, CON, INT, WIS, CHA });

describe('modifiers', () => {
	it('is the 5e curve, including the negative half', () => {
		expect([1, 8, 9, 10, 11, 12, 20].map(modifier)).toEqual([-5, -1, -1, 0, 0, 1, 5]);
	});

	it('writes a modifier the way a sheet does', () => {
		expect([formatModifier(2), formatModifier(0), formatModifier(-1)]).toEqual(['+2', '+0', '−1']);
	});
});

describe('background ability increases', () => {
	const acolyte = background('acolyte').abilityScores; // INT, WIS, CHA

	it('accepts one +2 and one +1', () => {
		expect(increasesAreLegal({ INT: 2, WIS: 1 }, acolyte)).toBe(true);
	});

	it('accepts +1 to all three', () => {
		expect(increasesAreLegal({ INT: 1, WIS: 1, CHA: 1 }, acolyte)).toBe(true);
	});

	it('rejects an ability the background does not offer', () => {
		expect(increasesAreLegal({ STR: 2, WIS: 1 }, acolyte)).toBe(false);
	});

	it('rejects spreads the rules do not allow', () => {
		expect(increasesAreLegal({ INT: 3 }, acolyte)).toBe(false);
		expect(increasesAreLegal({ INT: 2, WIS: 2 }, acolyte)).toBe(false);
		expect(increasesAreLegal({ INT: 1 }, acolyte)).toBe(false);
		expect(increasesAreLegal({}, acolyte)).toBe(false);
	});

	it('caps a final score at 20, as the SRD says it must', () => {
		expect(finalScore(19, 2)).toBe(20);
		expect(finalScore(15, 2)).toBe(17);
		expect(finalScore(null, 2)).toBeNull();
	});
});

describe('standard array', () => {
	it('accepts the pack’s array in any order', () => {
		expect(standardArrayIsLegal(scores(8, 10, 12, 13, 14, 15), gen)).toBe(true);
		expect(standardArrayIsLegal(scores(15, 14, 13, 12, 10, 8), gen)).toBe(true);
	});

	it('rejects a swapped-in extra point, and an incomplete spread', () => {
		expect(standardArrayIsLegal(scores(16, 14, 13, 12, 10, 8), gen)).toBe(false);
		expect(standardArrayIsLegal(scores(15, 14, 13, 12, 10, null), gen)).toBe(false);
	});
});

describe('point buy', () => {
	it('reads its cost table from the pack', () => {
		expect(pointCost(8, gen)).toBe(0);
		expect(pointCost(14, gen)).toBe(7);
		expect(pointCost(15, gen)).toBe(9);
		// Outside the buyable range — not merely expensive, but unavailable.
		expect(pointCost(16, gen)).toBeNull();
		expect(pointCost(7, gen)).toBeNull();
	});

	it('spends the whole budget on the classic 27-point spread', () => {
		const spread = scores(15, 15, 15, 8, 8, 8); // 9 + 9 + 9 = 27
		expect(pointsRemaining(spread, gen)).toBe(0);
		expect(pointBuyIsLegal(spread, gen)).toBe(true);
	});

	it('rejects going over budget', () => {
		const spread = scores(15, 15, 15, 10, 8, 8); // 27 + 2
		expect(pointsRemaining(spread, gen)).toBe(-2);
		expect(pointBuyIsLegal(spread, gen)).toBe(false);
	});

	it('rejects an unbuyable score even when the budget would allow it', () => {
		expect(pointBuyIsLegal(scores(16, 8, 8, 8, 8, 8), gen)).toBe(false);
	});
});

describe('rolling', () => {
	it('rolls 4d6 drop lowest, six times, from the pack’s notation', () => {
		// A deterministic rng: every die shows its maximum, so 4d6-drop-lowest
		// is 18 six times over.
		const pool = rollAbilityPool(gen, () => 0.999);
		expect(pool).toEqual([18, 18, 18, 18, 18, 18]);

		// Every die shows 1: three 1s survive the drop.
		expect(rollAbilityPool(gen, () => 0)).toEqual([3, 3, 3, 3, 3, 3]);
	});

	it('only accepts an assignment of the numbers actually rolled', () => {
		const pool = [15, 14, 13, 12, 10, 8];
		expect(rolledIsLegal(scores(8, 10, 12, 13, 14, 15), pool)).toBe(true);
		expect(rolledIsLegal(scores(16, 10, 12, 13, 14, 15), pool)).toBe(false);
		expect(rolledIsLegal(scores(15, 14, 13, 12, 10, null), pool)).toBe(false);
	});
});

describe('baseScoresAreLegal', () => {
	it('applies the validator for the method the character chose', () => {
		const c = createCharacter();
		expect(baseScoresAreLegal(c, rules)).toBe(false); // no method yet

		c.abilities.method = 'standard-array';
		c.abilities.base = scores(15, 14, 13, 12, 10, 8);
		expect(baseScoresAreLegal(c, rules)).toBe(true);

		// The standard array happens to cost exactly 27 points, so it is legal
		// under point buy too — the methods overlap rather than partition.
		c.abilities.method = 'point-buy';
		expect(baseScoresAreLegal(c, rules)).toBe(true);

		// They do diverge: 15/15/15/8/8/8 is a legal 27-point buy and is not
		// the standard array.
		c.abilities.base = scores(15, 15, 15, 8, 8, 8);
		expect(baseScoresAreLegal(c, rules)).toBe(true);
		c.abilities.method = 'standard-array';
		expect(baseScoresAreLegal(c, rules)).toBe(false);
		c.abilities.base = scores(15, 14, 13, 12, 10, 8);

		// And under rolling, legal only if that is what was rolled.
		c.abilities.method = 'roll';
		expect(baseScoresAreLegal(c, rules)).toBe(false);
		c.abilities.rolled = [15, 14, 13, 12, 10, 8];
		expect(baseScoresAreLegal(c, rules)).toBe(true);
	});
});
