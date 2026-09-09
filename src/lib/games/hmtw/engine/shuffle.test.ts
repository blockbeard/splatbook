import { describe, expect, it } from 'vitest';
import { seededRng, shuffle } from './shuffle';

describe('seededRng', () => {
	it('is deterministic for a seed, and different across seeds', () => {
		const a = seededRng(42);
		const b = seededRng(42);
		const c = seededRng(43);
		const draw = (rng: () => number) => [rng(), rng(), rng()];
		expect(draw(a)).toEqual(draw(b));
		expect(draw(seededRng(42))).not.toEqual(draw(c));
	});

	it('stays inside [0, 1)', () => {
		const rng = seededRng(7);
		for (let i = 0; i < 1000; i++) {
			const n = rng();
			expect(n).toBeGreaterThanOrEqual(0);
			expect(n).toBeLessThan(1);
		}
	});
});

describe('shuffle', () => {
	it('permutes without losing, duplicating, or mutating', () => {
		const cards = Array.from({ length: 56 }, (_, i) => `c${i}`);
		const original = [...cards];
		const shuffled = shuffle(cards, seededRng(1));
		expect(cards).toEqual(original); // input untouched
		expect(shuffled).toHaveLength(56);
		expect([...shuffled].sort()).toEqual([...cards].sort());
	});

	it('actually reorders a deck-sized pile', () => {
		const cards = Array.from({ length: 56 }, (_, i) => `c${i}`);
		expect(shuffle(cards, seededRng(1))).not.toEqual(cards);
	});

	it('gives the same order for the same seed — the property the table relies on', () => {
		const cards = Array.from({ length: 20 }, (_, i) => `c${i}`);
		expect(shuffle(cards, seededRng(99))).toEqual(shuffle(cards, seededRng(99)));
	});

	it('handles the degenerate piles without complaint', () => {
		expect(shuffle([], seededRng(1))).toEqual([]);
		expect(shuffle(['only'], seededRng(1))).toEqual(['only']);
	});
});
