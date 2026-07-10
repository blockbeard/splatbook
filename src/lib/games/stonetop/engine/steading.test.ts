/**
 * Steading engine model tests — the pure rules for the second entity type.
 * Stats clamp to their printed ranges, Size walks the ladder, the season cycles
 * and wraps the year, debilities toggle, and creation seeds the 2nd-printing
 * starting values. Every function is pure: the input steading is never mutated.
 */

import { describe, it, expect } from 'vitest';
import {
	STEADING_SCHEMA_VERSION,
	STEADING_STAT_KEYS,
	SIZE_LADDER,
	SEASONS,
	createSteading,
	migrateSteading,
	clampStat,
	setStat,
	bumpStat,
	statAtMin,
	statAtMax,
	setSize,
	bumpSize,
	setSeason,
	advanceSeason,
	isDebilitated,
	setDebility,
	toggleDebility
} from './steading.ts';

describe('createSteading', () => {
	it('starts at the printed 2nd-printing values', () => {
		const s = createSteading();
		expect(s.schemaVersion).toBe(STEADING_SCHEMA_VERSION);
		expect(s.entityType).toBe('steading');
		expect(s.stats).toEqual({
			fortunes: 1,
			surplus: 1,
			population: 0,
			prosperity: 0,
			defenses: 0
		});
		expect(s.size).toBe('village');
		expect(s.season).toBe('spring');
		expect(Object.values(s.debilities).every((v) => v === false)).toBe(true);
	});

	it('starts every content list empty (the editor seeds from the pack)', () => {
		const s = createSteading();
		expect(s.resources).toEqual([]);
		expect(s.fortifications).toEqual([]);
		expect(s.placesOfInterest).toEqual([]);
		expect(s.assets).toEqual([]);
		expect(s.residents).toEqual([]);
		expect(s.neighbors).toEqual([]);
		expect(s.improvements).toEqual({});
	});
});

describe('clampStat', () => {
	it('clamps −1…+3 tracks at both ends', () => {
		expect(clampStat('fortunes', 5)).toBe(3);
		expect(clampStat('fortunes', -5)).toBe(-1);
		expect(clampStat('defenses', 2)).toBe(2);
	});

	it('floors Surplus at 0 but leaves it unbounded above', () => {
		expect(clampStat('surplus', -3)).toBe(0);
		expect(clampStat('surplus', 99)).toBe(99);
	});
});

describe('setStat / bumpStat', () => {
	it('sets a stat, clamped, without mutating the input', () => {
		const s = createSteading();
		const next = setStat(s, 'prosperity', 9);
		expect(next.stats.prosperity).toBe(3);
		expect(s.stats.prosperity).toBe(0); // original untouched
	});

	it('bumps a stat by a delta, clamped', () => {
		let s = createSteading();
		s = bumpStat(s, 'defenses', 2);
		expect(s.stats.defenses).toBe(2);
		s = bumpStat(s, 'defenses', 5);
		expect(s.stats.defenses).toBe(3); // capped
		s = bumpStat(s, 'defenses', -10);
		expect(s.stats.defenses).toBe(-1); // floored
	});

	it('knows when a stat is at a range end', () => {
		expect(statAtMin('fortunes', -1)).toBe(true);
		expect(statAtMax('fortunes', 3)).toBe(true);
		expect(statAtMax('surplus', 999)).toBe(false); // unbounded
	});
});

describe('size ladder', () => {
	it('sets a size directly', () => {
		expect(setSize(createSteading(), 'town').size).toBe('town');
	});

	it('walks the ladder and clamps at its ends', () => {
		let s = createSteading(); // village (index 1)
		s = bumpSize(s, 1);
		expect(s.size).toBe('town');
		s = bumpSize(s, 5);
		expect(s.size).toBe(SIZE_LADDER[SIZE_LADDER.length - 1]); // city
		s = bumpSize(s, -10);
		expect(s.size).toBe('hamlet');
	});
});

describe('season cycle', () => {
	it('sets and advances, wrapping winter back to spring', () => {
		let s = setSeason(createSteading(), 'winter');
		expect(s.season).toBe('winter');
		s = advanceSeason(s);
		expect(s.season).toBe('spring');
	});

	it('advances through all four in order', () => {
		let s = createSteading();
		const seen = [s.season];
		for (let i = 0; i < 4; i++) {
			s = advanceSeason(s);
			seen.push(s.season);
		}
		expect(seen).toEqual(['spring', 'summer', 'autumn', 'winter', 'spring']);
		expect([...SEASONS]).toEqual(['spring', 'summer', 'autumn', 'winter']);
	});
});

describe('debilities', () => {
	it('toggles and sets a debility without touching the others', () => {
		let s = createSteading();
		s = toggleDebility(s, 'lacking');
		expect(isDebilitated(s, 'lacking')).toBe(true);
		expect(isDebilitated(s, 'diminished')).toBe(false);
		s = setDebility(s, 'lacking', false);
		expect(isDebilitated(s, 'lacking')).toBe(false);
	});
});

describe('migrateSteading', () => {
	it('fills missing fields and stamps the current version', () => {
		// A truncated older blob missing newer fields.
		const partial = {
			schemaVersion: 0,
			entityType: 'steading',
			name: 'Ringwall',
			stats: { fortunes: 2, surplus: 4, population: 1, prosperity: 1, defenses: 2 },
			size: 'village',
			season: 'autumn',
			debilities: { diminished: false, lacking: true, malcontent: false }
		} as unknown as ReturnType<typeof createSteading>;
		const migrated = migrateSteading(partial);
		expect(migrated.schemaVersion).toBe(STEADING_SCHEMA_VERSION);
		expect(migrated.name).toBe('Ringwall');
		expect(migrated.stats.surplus).toBe(4);
		expect(migrated.season).toBe('autumn');
		// Missing fields recovered from a fresh steading.
		expect(migrated.resources).toEqual([]);
		expect(migrated.treasure).toEqual({ silver: '', gold: '' });
		expect(migrated.safety).toEqual({ excluded: [], veiled: [], specialHandling: [] });
	});
});

describe('STEADING_STAT_KEYS', () => {
	it('is the five numeric stats in printed order', () => {
		expect([...STEADING_STAT_KEYS]).toEqual([
			'fortunes',
			'surplus',
			'population',
			'prosperity',
			'defenses'
		]);
	});
});
