import { describe, expect, it } from 'vitest';
import { createCharacter, type StonetopCharacter } from './character';
import type { Playbook } from '../pack-schemas';
import {
	applyDamage,
	bankedXp,
	canLevelUp,
	debilityName,
	effectiveStat,
	effectiveStats,
	enterPlay,
	healHp,
	heldMoveIds,
	isDebilitated,
	isStatDebilitated,
	markXp,
	seedVitals,
	setDebility,
	setHp,
	statRollMode,
	syncMoveTrackers,
	xpForNextLevel
} from './play';

/** A playbook with a fixed tracker move (Boon) and an optional one (Resolve). */
const playbook = {
	base: { damage: 'd6', maxHp: 18 },
	backgrounds: [{ id: 'initiate', name: 'Initiate', grants: { moves: ['barkskin'] } }],
	stats: {
		array: [2, 1, 1, 0, 0, -1],
		debilities: [
			{ name: 'Weakened', stats: ['STR'] },
			{ name: 'Shaken', stats: ['WIS', 'CHA'] }
		]
	},
	moves: {
		starting: { fixed: ['spirit-tongue'], choose: 1 },
		list: [
			{ id: 'spirit-tongue', name: 'Spirit Tongue', text: '…' },
			{ id: 'barkskin', name: 'Barkskin', text: '…' },
			{ id: 'rites', name: 'Rites of the Land', text: '…', tracker: { boxes: 4, label: 'Boon' } },
			{ id: 'anger', name: 'Anger', text: '…', tracker: { boxes: 2, label: 'Resolve' } }
		]
	}
} as unknown as Playbook;

/** A character with STR=2, WIS=0 assigned; on `the-blessed`, background chosen. */
const seeded = (moves: string[] = []): StonetopCharacter => ({
	...createCharacter('the-blessed'),
	backgroundId: 'initiate',
	stats: { STR: { value: 2 }, WIS: { value: 0 } },
	moves
});

describe('xpForNextLevel / canLevelUp', () => {
	it('is 6 + twice the current level', () => {
		expect(xpForNextLevel(1)).toBe(8);
		expect(xpForNextLevel(2)).toBe(10);
		expect(xpForNextLevel(6)).toBe(18);
	});

	it('reads whether the banked XP clears the threshold', () => {
		const c = seeded();
		expect(canLevelUp({ ...c, level: 1, xp: 7 })).toBe(false);
		expect(canLevelUp({ ...c, level: 1, xp: 8 })).toBe(true);
		expect(canLevelUp({ ...c, level: 1, xp: 20 })).toBe(true);
	});
});

describe('markXp', () => {
	it('adds and never drops below zero', () => {
		const c = seeded();
		expect(markXp(c).xp).toBe(1);
		expect(markXp(c, 3).xp).toBe(3);
		expect(markXp({ ...c, xp: 2 }, -5).xp).toBe(0);
	});

	// You earn the point that levels you mid-session and keep playing; XP has to
	// have somewhere to go before you stop to spend it.
	it('banks past the level threshold', () => {
		const c = { ...seeded(), level: 1, xp: 8 }; // 8 is the threshold at level 1
		expect(markXp(c).xp).toBe(9);
		expect(markXp(c, 3).xp).toBe(11);
	});
});

describe('bankedXp', () => {
	it('is nothing until the threshold is cleared', () => {
		const c = seeded();
		expect(bankedXp({ ...c, level: 1, xp: 0 })).toBe(0);
		expect(bankedXp({ ...c, level: 1, xp: 8 })).toBe(0);
	});

	it('counts the surplus held past the threshold', () => {
		const c = seeded();
		expect(bankedXp({ ...c, level: 1, xp: 11 })).toBe(3);
		expect(bankedXp({ ...c, level: 2, xp: 11 })).toBe(1); // level 2 costs 10
	});
});

describe('heldMoveIds', () => {
	it('unions fixed, background grants, and chosen moves', () => {
		const ids = heldMoveIds(seeded(['rites']), playbook);
		expect([...ids].sort()).toEqual(['barkskin', 'rites', 'spirit-tongue']);
	});
});

describe('seedVitals', () => {
	it('fills HP to the playbook max on first entry and records damage', () => {
		const c = seedVitals(seeded(), playbook);
		expect(c.hp).toEqual({ current: 18, max: 18 });
		expect(c.damage).toBe('d6');
	});

	it('preserves current HP on re-entry, only re-clamping to max', () => {
		const wounded = { ...seeded(), hp: { current: 5, max: 18 }, damage: 'd6' };
		expect(seedVitals(wounded, playbook).hp).toEqual({ current: 5, max: 18 });
	});
});

describe('syncMoveTrackers', () => {
	it('creates a tracker for each held tracker-move', () => {
		const c = syncMoveTrackers(seeded(['rites']), playbook);
		expect(c.trackers.rites).toEqual({ label: 'Boon', boxes: 4, marked: 0 });
		expect(c.trackers.anger).toBeUndefined();
	});

	it('preserves marks and drops trackers for retired moves', () => {
		let c = seeded(['rites', 'anger']);
		c = syncMoveTrackers(c, playbook);
		c = { ...c, trackers: { ...c.trackers, rites: { ...c.trackers.rites, marked: 3 } } };
		// retire "anger"; keep rites' marks
		c = { ...c, moves: ['rites'] };
		c = syncMoveTrackers(c, playbook);
		expect(c.trackers.rites.marked).toBe(3);
		expect(c.trackers.anger).toBeUndefined();
	});

	it('re-clamps marks if a tracker shrank', () => {
		let c = syncMoveTrackers(seeded(['anger']), playbook);
		c = { ...c, trackers: { anger: { label: 'Resolve', boxes: 5, marked: 5 } } };
		c = syncMoveTrackers(c, playbook);
		expect(c.trackers.anger).toEqual({ label: 'Resolve', boxes: 2, marked: 2 });
	});
});

describe('enterPlay', () => {
	it('seeds vitals and trackers together, idempotently', () => {
		const once = enterPlay(seeded(['rites']), playbook);
		const twice = enterPlay(once, playbook);
		expect(once).toEqual(twice);
		expect(once.hp).toEqual({ current: 18, max: 18 });
		expect(once.trackers.rites.boxes).toBe(4);
	});
});

describe('HP', () => {
	it('clamps damage at 0 and heal at max', () => {
		const c = seedVitals(seeded(), playbook); // 18/18
		expect(applyDamage(c, 5).hp.current).toBe(13);
		expect(applyDamage(c, 99).hp.current).toBe(0);
		expect(healHp(applyDamage(c, 5), 99).hp.current).toBe(18);
		expect(setHp(c, -3).hp.current).toBe(0);
	});
});

describe('debilities', () => {
	it('marks one condition, readable from either linked stat', () => {
		const c = setDebility(seeded(), 'weakened', true);
		expect(isDebilitated(c, 'weakened')).toBe(true);
		expect(isStatDebilitated(c, 'STR')).toBe(true);
		expect(isStatDebilitated(c, 'DEX')).toBe(true); // the pair, assigned or not
		expect(isStatDebilitated(c, 'WIS')).toBe(false);
		expect(isDebilitated(setDebility(c, 'weakened', false), 'weakened')).toBe(false);
	});

	it('imposes disadvantage on the pair — never a smaller modifier', () => {
		const c = setDebility(seeded(), 'weakened', true);
		expect(effectiveStat(c, 'STR')).toBe(2); // the number is untouched
		expect(statRollMode(c, 'STR')).toBe('disadvantage');
		expect(statRollMode(c, 'DEX')).toBe('disadvantage');
		expect(statRollMode(c, 'WIS')).toBe('normal');
	});

	it('effectiveStats collects only assigned stats', () => {
		const c = setDebility(seeded(), 'weakened', true);
		expect(effectiveStats(c)).toEqual({ STR: 2, WIS: 0 });
	});

	it('names a stat debility from the playbook', () => {
		expect(debilityName(playbook, 'STR')).toBe('Weakened');
		expect(debilityName(playbook, 'CHA')).toBe('Shaken');
		expect(debilityName(playbook, 'DEX')).toBeUndefined();
	});
});
