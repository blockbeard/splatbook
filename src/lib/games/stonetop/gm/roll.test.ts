import { describe, it, expect } from 'vitest';
import { parseRange, rangeIncludes, rollDie, matchingRowIndex } from './roll';

describe('parseRange', () => {
	it('parses a single value', () => {
		expect(parseRange('4')).toEqual({ min: 4, max: 4 });
	});

	it('parses a hyphen range', () => {
		expect(parseRange('2-3')).toEqual({ min: 2, max: 3 });
	});

	it('parses an en-dash range and normalises order', () => {
		expect(parseRange('4–6')).toEqual({ min: 4, max: 6 });
	});

	it('yields a match-nothing range for a malformed spec', () => {
		const r = parseRange('nope');
		expect(r.min).toBeNaN();
		expect(rangeIncludes('nope', 3)).toBe(false);
	});
});

describe('rangeIncludes', () => {
	it('includes the endpoints of a range', () => {
		expect(rangeIncludes('4-6', 4)).toBe(true);
		expect(rangeIncludes('4-6', 6)).toBe(true);
		expect(rangeIncludes('4-6', 3)).toBe(false);
		expect(rangeIncludes('4-6', 7)).toBe(false);
	});

	it('matches a single-value row exactly', () => {
		expect(rangeIncludes('1', 1)).toBe(true);
		expect(rangeIncludes('1', 2)).toBe(false);
	});
});

describe('rollDie', () => {
	it('maps rng 0 to the low face and just-under-1 to the high face', () => {
		expect(rollDie(6, () => 0)).toBe(1);
		expect(rollDie(6, () => 0.999)).toBe(6);
	});

	it('stays within 1..sides across the unit interval', () => {
		for (const p of [0, 0.16, 0.5, 0.83, 0.999]) {
			const v = rollDie(6, () => p);
			expect(v).toBeGreaterThanOrEqual(1);
			expect(v).toBeLessThanOrEqual(6);
		}
	});
});

describe('matchingRowIndex', () => {
	// The When-the-Way-is-Perilous table: 1 / 2-3 / 4-5 / 6.
	const specs = ['1', '2-3', '4-5', '6'];

	it('finds the row for each face of the die', () => {
		expect(matchingRowIndex(specs, 1)).toBe(0);
		expect(matchingRowIndex(specs, 2)).toBe(1);
		expect(matchingRowIndex(specs, 3)).toBe(1);
		expect(matchingRowIndex(specs, 5)).toBe(2);
		expect(matchingRowIndex(specs, 6)).toBe(3);
	});

	it('returns -1 when no row covers the roll', () => {
		expect(matchingRowIndex(['1', '2'], 6)).toBe(-1);
	});
});
