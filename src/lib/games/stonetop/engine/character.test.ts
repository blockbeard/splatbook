import { describe, expect, it } from 'vitest';
import {
	SCHEMA_VERSION,
	STAT_KEYS,
	createCharacter,
	setTrackerMarks,
	statValue,
	type StonetopCharacter
} from './character';

describe('createCharacter', () => {
	it('produces a blank character stamped with the current schema version', () => {
		const c = createCharacter();
		expect(c.schemaVersion).toBe(SCHEMA_VERSION);
		expect(c.playbookId).toBeNull();
		expect(c.level).toBe(1);
		expect(c.xp).toBe(0);
		expect(c.moves).toEqual([]);
		expect(c.stats).toEqual({});
		expect(c.trackers).toEqual({});
	});

	it('accepts an optional starting playbook id without seeding pack-derived data', () => {
		const c = createCharacter('the-blessed');
		expect(c.playbookId).toBe('the-blessed');
		// Pack-derived defaults (hp, damage, trackers) are applied by steps, not here.
		expect(c.hp).toEqual({ current: 0, max: 0 });
		expect(c.damage).toBeNull();
	});

	it('has one entry per stat only once assigned (empty by default)', () => {
		const c = createCharacter();
		for (const key of STAT_KEYS) {
			expect(statValue(c, key)).toBeUndefined();
		}
	});
});

describe('setTrackerMarks', () => {
	const withTracker = (): StonetopCharacter => ({
		...createCharacter(),
		trackers: { boon: { label: 'Boon', boxes: 4, marked: 1 } }
	});

	it('clamps marks into [0, boxes] and does not mutate the input', () => {
		const c = withTracker();
		const over = setTrackerMarks(c, 'boon', 9);
		expect(over?.trackers.boon.marked).toBe(4);
		const under = setTrackerMarks(c, 'boon', -3);
		expect(under?.trackers.boon.marked).toBe(0);
		// original untouched
		expect(c.trackers.boon.marked).toBe(1);
	});

	it('sets a valid mark count', () => {
		const c = setTrackerMarks(withTracker(), 'boon', 3);
		expect(c?.trackers.boon.marked).toBe(3);
	});

	it('returns undefined for an unknown tracker', () => {
		expect(setTrackerMarks(withTracker(), 'omens', 2)).toBeUndefined();
	});
});

describe('statValue', () => {
	it('reads an assigned stat and undefined for an unassigned one', () => {
		const c: StonetopCharacter = {
			...createCharacter(),
			stats: { STR: { value: 2, debilitated: false } }
		};
		expect(statValue(c, 'STR')).toBe(2);
		expect(statValue(c, 'DEX')).toBeUndefined();
	});
});
