import { describe, expect, it } from 'vitest';
import { formatSpec, isValidNotation, parseNotation } from './notation';

describe('parseNotation', () => {
	it('parses a simple XdY', () => {
		const spec = parseNotation('2d6');
		expect(spec.terms).toEqual([{ count: 2, sides: 6 }]);
		expect(spec.modifier).toBe(0);
		expect(spec.notation).toBe('2d6');
	});

	it('defaults an omitted count to one die', () => {
		expect(parseNotation('d20').terms).toEqual([{ count: 1, sides: 20 }]);
	});

	it('applies a positive flat modifier', () => {
		const spec = parseNotation('3d8+2');
		expect(spec.terms).toEqual([{ count: 3, sides: 8 }]);
		expect(spec.modifier).toBe(2);
	});

	it('applies a negative flat modifier', () => {
		expect(parseNotation('1d20-2').modifier).toBe(-2);
	});

	it('sums multiple flat modifiers with their signs', () => {
		expect(parseNotation('1d20+5-2').modifier).toBe(3);
	});

	it('accepts multiple dice terms of different sizes', () => {
		const spec = parseNotation('2d6+1d4+3');
		expect(spec.terms).toEqual([
			{ count: 2, sides: 6 },
			{ count: 1, sides: 4 }
		]);
		expect(spec.modifier).toBe(3);
		expect(spec.notation).toBe('2d6+1d4+3');
	});

	it('ignores whitespace and letter case', () => {
		const spec = parseNotation('  2D6 + 3 ');
		expect(spec.terms).toEqual([{ count: 2, sides: 6 }]);
		expect(spec.modifier).toBe(3);
		expect(spec.notation).toBe('2d6+3');
	});

	it.each(['', '   ', 'abc', '2d', 'd', '2d6++1', '2x6', '2d6+', '+', '5'])(
		'rejects malformed notation %j',
		(bad) => {
			expect(() => parseNotation(bad)).toThrow();
		}
	);

	it('rejects a subtracted die term', () => {
		expect(() => parseNotation('2d6-1d4')).toThrow(/cannot be subtracted/);
	});

	it('rejects a zero-sided die', () => {
		expect(() => parseNotation('1d0')).toThrow(/at least one side/);
	});
});

describe('formatSpec', () => {
	it('omits a zero modifier', () => {
		expect(formatSpec([{ count: 2, sides: 6 }], 0)).toBe('2d6');
	});

	it('keeps a negative modifier sign', () => {
		expect(formatSpec([{ count: 1, sides: 20 }], -2)).toBe('1d20-2');
	});

	it('joins multiple dice terms with plus', () => {
		expect(
			formatSpec(
				[
					{ count: 2, sides: 6 },
					{ count: 1, sides: 4 }
				],
				1
			)
		).toBe('2d6+1d4+1');
	});
});

describe('isValidNotation', () => {
	it('is true for well-formed notation', () => {
		expect(isValidNotation('2d6+1')).toBe(true);
	});

	it('is false for garbage', () => {
		expect(isValidNotation('not dice')).toBe(false);
	});
});
