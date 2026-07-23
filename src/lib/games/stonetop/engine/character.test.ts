import { describe, expect, it } from 'vitest';
import {
	SCHEMA_VERSION,
	STAT_KEYS,
	createCharacter,
	setTrackerMarks,
	statValue,
	autoAttachedInsertIds,
	attachInsert,
	detachInsert,
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
			stats: { STR: { value: 2 } }
		};
		expect(statValue(c, 'STR')).toBe(2);
		expect(statValue(c, 'DEX')).toBeUndefined();
	});
});

describe('autoAttachedInsertIds', () => {
	it('attaches Invocations to a Lightbearer', () => {
		const c = createCharacter('the-lightbearer');
		expect(autoAttachedInsertIds(c)).toContain('insert-invocations');
	});

	it('attaches Crew to a Marshal', () => {
		const c = createCharacter('the-marshal');
		expect(autoAttachedInsertIds(c)).toContain('insert-crew');
	});

	it('attaches Initiates of Danu to a Blessed with the Initiate background', () => {
		const initiate = { ...createCharacter('the-blessed'), backgroundId: 'initiate' };
		expect(autoAttachedInsertIds(initiate)).toContain('insert-initiates-of-danu');

		// A Blessed with a different background doesn't qualify.
		const other = { ...createCharacter('the-blessed'), backgroundId: 'raised-by-wolves' };
		expect(autoAttachedInsertIds(other)).not.toContain('insert-initiates-of-danu');
	});

	it("doesn't attach Initiates of Danu to a non-Blessed with a same-named background id", () => {
		const c = { ...createCharacter('the-ranger'), backgroundId: 'initiate' };
		expect(autoAttachedInsertIds(c)).not.toContain('insert-initiates-of-danu');
	});

	it('attaches Animal Companion to whoever holds the move, not just Rangers', () => {
		const ranger = { ...createCharacter('the-ranger'), moves: ['animal-companion'] };
		expect(autoAttachedInsertIds(ranger)).toContain('insert-animal-companion');

		// A Ranger who didn't pick it doesn't qualify — the move isn't fixed.
		const noPick = createCharacter('the-ranger');
		expect(autoAttachedInsertIds(noPick)).not.toContain('insert-animal-companion');

		// Gained through advancement instead of at creation still counts.
		const viaAdvancement = {
			...createCharacter('the-would-be-hero'),
			advancement: [{ level: 2, moveId: 'animal-companion' }]
		};
		expect(autoAttachedInsertIds(viaAdvancement)).toContain('insert-animal-companion');
	});

	it('attaches nothing for a fresh character with no qualifying playbook', () => {
		expect(autoAttachedInsertIds(createCharacter('the-heavy'))).toEqual([]);
		expect(autoAttachedInsertIds(createCharacter())).toEqual([]);
	});
});

describe('attachInsert / detachInsert', () => {
	it('attaches an insert with its initial state', () => {
		const c = attachInsert(createCharacter(), 'insert-followers', { roster: [] });
		expect(c.inserts['insert-followers']).toEqual({ roster: [] });
	});

	it('defaults to an empty state blob', () => {
		const c = attachInsert(createCharacter(), 'insert-ghost');
		expect(c.inserts['insert-ghost']).toEqual({});
	});

	it('attaching an already-attached insert leaves its state untouched', () => {
		const c = attachInsert(createCharacter(), 'insert-followers', { roster: ['Enfys'] });
		const reattached = attachInsert(c, 'insert-followers', { roster: [] });
		expect(reattached.inserts['insert-followers']).toEqual({ roster: ['Enfys'] });
	});

	it('does not mutate the input', () => {
		const c = createCharacter();
		attachInsert(c, 'insert-followers');
		expect(c.inserts).toEqual({});
	});

	it('detaches an attached insert', () => {
		const attached = attachInsert(createCharacter(), 'insert-crew');
		const detached = detachInsert(attached, 'insert-crew');
		expect(detached.inserts).toEqual({});
	});

	it('detaching an insert that is not attached is a no-op', () => {
		const c = createCharacter();
		expect(detachInsert(c, 'insert-thrall')).toBe(c);
	});
});
