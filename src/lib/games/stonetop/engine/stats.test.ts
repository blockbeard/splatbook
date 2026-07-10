import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import {
	assignStat,
	assignedValues,
	clearStat,
	isStatArrayComplete,
	remainingValues
} from './stats';

const ARRAY = [2, 1, 1, 0, 0, -1];

describe('assignStat / clearStat', () => {
	it('assigns and clears without mutating', () => {
		const base = createCharacter();
		const a = assignStat(base, 'STR', 2);
		expect(a.stats.STR).toEqual({ value: 2, debilitated: false });
		expect(base.stats.STR).toBeUndefined();
		expect(clearStat(a, 'STR').stats.STR).toBeUndefined();
	});
});

describe('assignedValues', () => {
	it('lists assigned values as a multiset', () => {
		let c = createCharacter();
		c = assignStat(c, 'STR', 2);
		c = assignStat(c, 'DEX', 1);
		expect(assignedValues(c.stats).sort()).toEqual([1, 2]);
	});
});

describe('remainingValues', () => {
	it('removes values held by other stats, keeping duplicates correct', () => {
		let c = createCharacter();
		c = assignStat(c, 'STR', 2);
		c = assignStat(c, 'DEX', 1); // one of the two 1s used
		expect(remainingValues(ARRAY, c.stats).sort((a, b) => a - b)).toEqual([-1, 0, 0, 1]);
	});

	it("keeps a stat's own value available via `except`", () => {
		let c = createCharacter();
		c = assignStat(c, 'STR', 2);
		expect(remainingValues(ARRAY, c.stats, 'STR')).toContain(2);
		expect(remainingValues(ARRAY, c.stats)).not.toContain(2);
	});
});

describe('isStatArrayComplete', () => {
	it('is false until all six are assigned', () => {
		let c = createCharacter();
		c = assignStat(c, 'STR', 2);
		expect(isStatArrayComplete(ARRAY, c.stats)).toBe(false);
	});

	it('is true for a valid permutation of the array', () => {
		let c = createCharacter();
		const keys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
		ARRAY.forEach((v, i) => (c = assignStat(c, keys[i], v)));
		expect(isStatArrayComplete(ARRAY, c.stats)).toBe(true);
	});

	it('is false if a value not in the array is used', () => {
		let c = createCharacter();
		const keys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
		[2, 1, 1, 0, 0, 3].forEach((v, i) => (c = assignStat(c, keys[i], v)));
		expect(isStatArrayComplete(ARRAY, c.stats)).toBe(false);
	});
});
