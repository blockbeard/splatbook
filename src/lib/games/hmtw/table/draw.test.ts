import { describe, expect, it } from 'vitest';
import { gmDrawFacts } from './draw';

const group = (family: string, up: number, down = 0) => ({
	family,
	creatures: [
		...Array.from({ length: up }, () => ({ down: false })),
		...Array.from({ length: down }, () => ({ down: true }))
	]
});

describe('what the table knows about the GM’s draw', () => {
	it('counts types of enemy, not enemies — the first live test’s 7 that should have been 6', () => {
		const facts = gmDrawFacts([group('zombie', 3), group('king', 1)], 3);
		expect(facts['enemy-types']).toBe(2);
		expect(facts.outnumber).toBe(true);
		expect(facts.twice).toBe(false);
		expect(facts['three-adventurers']).toBe(true);
	});

	it('follows the book’s imps: twelve against four is double, seven is not', () => {
		expect(gmDrawFacts([group('imp', 12)], 4).twice).toBe(true);
		expect(gmDrawFacts([group('imp', 7)], 4).twice).toBe(false);
		expect(gmDrawFacts([group('imp', 7)], 4).outnumber).toBe(true);
	});

	it('stops counting a type once every one of it is down', () => {
		const facts = gmDrawFacts([group('zombie', 0, 3), group('king', 1)], 3);
		expect(facts['enemy-types']).toBe(1);
		expect(facts.outnumber).toBe(false);
	});

	it('claims nothing about outnumbering an empty table', () => {
		const facts = gmDrawFacts([group('zombie', 3)], 0);
		expect(facts.outnumber).toBe(false);
		expect(facts.twice).toBe(false);
	});
});
