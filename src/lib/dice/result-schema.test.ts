import { describe, expect, it } from 'vitest';
import { roll } from './roll';
import { rollResultSchema } from './result-schema';

describe('rollResultSchema', () => {
	it('accepts a real engine result', () => {
		const r = roll('2d6+1', { rng: () => 0.5 });
		expect(rollResultSchema.parse(r)).toEqual(r);
	});

	it('accepts an advantage result with a dropped die', () => {
		const r = roll('1d20', { rng: () => 0.5, mode: 'advantage' });
		expect(() => rollResultSchema.parse(r)).not.toThrow();
	});

	it('rejects an unknown mode', () => {
		const bad = {
			notation: '2d6',
			mode: 'lucky',
			dice: [{ sides: 6, value: 3, kept: true }],
			modifier: 0,
			bonus: 0,
			total: 3
		};
		expect(rollResultSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects an empty dice array', () => {
		const bad = { notation: '2d6', mode: 'normal', dice: [], modifier: 0, bonus: 0, total: 0 };
		expect(rollResultSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects extra keys (strict)', () => {
		const bad = {
			notation: '2d6',
			mode: 'normal',
			dice: [{ sides: 6, value: 3, kept: true }],
			modifier: 0,
			bonus: 0,
			total: 3,
			injected: 'x'
		};
		expect(rollResultSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects a die value outside its bounds', () => {
		const bad = {
			notation: '2d6',
			mode: 'normal',
			dice: [{ sides: 6, value: 0, kept: true }],
			modifier: 0,
			bonus: 0,
			total: 0
		};
		expect(rollResultSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects a missing bonus', () => {
		const bad = {
			notation: '2d6',
			mode: 'normal',
			dice: [{ sides: 6, value: 3, kept: true }],
			modifier: 0,
			total: 3
		};
		expect(rollResultSchema.safeParse(bad).success).toBe(false);
	});

	it('rejects a bonus outside its bounds', () => {
		const bad = {
			notation: '2d6',
			mode: 'normal',
			dice: [{ sides: 6, value: 3, kept: true }],
			modifier: 0,
			bonus: 1001,
			total: 3
		};
		expect(rollResultSchema.safeParse(bad).success).toBe(false);
	});
});
