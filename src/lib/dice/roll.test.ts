import { describe, expect, it } from 'vitest';
import { parseNotation } from './notation';
import { roll, rollDie, type Rng } from './roll';

/** A deterministic rng that yields the given floats in order. */
function rng(...values: number[]): Rng {
	let i = 0;
	return () => values[i++];
}

/** The rng float that makes `rollDie(sides)` land on face `f`. */
function face(sides: number, f: number): number {
	return (f - 0.5) / sides;
}

describe('rollDie', () => {
	it('maps the rng floor to face 1', () => {
		expect(rollDie(6, () => 0)).toBe(1);
	});

	it('maps the rng ceiling to the top face', () => {
		expect(rollDie(6, () => 0.999999)).toBe(6);
	});

	it('lands on the intended face', () => {
		expect(rollDie(20, () => face(20, 13))).toBe(13);
	});
});

describe('roll', () => {
	it('sums the dice with no modifier', () => {
		const r = roll('2d6', { rng: rng(face(6, 3), face(6, 5)) });
		expect(r.dice.map((d) => d.value)).toEqual([3, 5]);
		expect(r.dice.every((d) => d.kept)).toBe(true);
		expect(r.modifier).toBe(0);
		expect(r.total).toBe(8);
		expect(r.mode).toBe('normal');
	});

	it('adds a flat modifier to the total', () => {
		const r = roll('1d6+3', { rng: rng(face(6, 4)) });
		expect(r.total).toBe(7);
		expect(r.modifier).toBe(3);
	});

	it('subtracts a negative modifier', () => {
		const r = roll('1d20-2', { rng: rng(face(20, 10)) });
		expect(r.total).toBe(8);
	});

	it('echoes the canonical notation', () => {
		expect(roll('2d6+1', { rng: rng(face(6, 1), face(6, 1)) }).notation).toBe('2d6+1');
	});

	it('accepts an already-parsed spec', () => {
		const spec = parseNotation('1d4');
		expect(roll(spec, { rng: rng(face(4, 3)) }).total).toBe(3);
	});

	describe('advantage', () => {
		it('rolls an extra die and keeps the best (d20 case)', () => {
			const r = roll('1d20', { rng: rng(face(20, 7), face(20, 15)), mode: 'advantage' });
			expect(r.dice).toHaveLength(2);
			expect(r.total).toBe(15);
			expect(r.dice.find((d) => d.value === 7)?.kept).toBe(false);
			expect(r.dice.find((d) => d.value === 15)?.kept).toBe(true);
		});

		it('drops only the single lowest die on a 2d6 roll', () => {
			const r = roll('2d6', { rng: rng(face(6, 2), face(6, 6), face(6, 4)), mode: 'advantage' });
			expect(r.dice).toHaveLength(3);
			expect(r.dice.filter((d) => d.kept)).toHaveLength(2);
			expect(r.total).toBe(10); // 6 + 4, the 2 dropped
		});
	});

	describe('disadvantage', () => {
		it('rolls an extra die and keeps the worst', () => {
			const r = roll('1d20', { rng: rng(face(20, 7), face(20, 15)), mode: 'disadvantage' });
			expect(r.total).toBe(7);
			expect(r.dice.find((d) => d.value === 15)?.kept).toBe(false);
		});
	});

	it('keeps dropped dice in roll order for display', () => {
		const r = roll('1d20', { rng: rng(face(20, 7), face(20, 15)), mode: 'advantage' });
		expect(r.dice.map((d) => d.value)).toEqual([7, 15]);
	});
});
