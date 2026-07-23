import { describe, expect, it } from 'vitest';
import {
	SCHEMA_VERSION,
	createCharacter,
	migrateCharacter,
	type StonetopCharacter
} from './character';
import type { Playbook } from '../pack-schemas';
import {
	advancementLog,
	applyLevelUp,
	isMaxedOut,
	legalChoices,
	levelUpChoices,
	maxTakes,
	meetsLevel,
	timesTaken
} from './advancement';

/**
 * A playbook shaped after the Blessed / Would-be Hero: a fixed starting move
 * with a child, a level-2 move, level-6 moves (one gated on a prerequisite),
 * a repeatable Improved Stat, and a replacement move.
 */
const playbook = {
	base: { damage: 'd6', maxHp: 18 },
	backgrounds: [{ id: 'initiate', name: 'Initiate', grants: { moves: ['barkskin'] } }],
	stats: { array: [2, 1, 1, 0, 0, -1], debilities: [] },
	moves: {
		starting: { fixed: ['spirit-tongue'], choose: 1 },
		list: [
			{ id: 'spirit-tongue', name: 'Spirit Tongue', text: '…' },
			{ id: 'barkskin', name: 'Barkskin', text: '…' },
			{ id: 'healers-arts', name: "Healer's Arts", text: '…' },
			{ id: 'into-the-lions-den', name: "Into the Lion's Den", text: '…' },
			{
				id: 'call-the-spirits',
				name: 'Call the Spirits',
				text: '…',
				childOf: 'spirit-tongue',
				requires: { moves: ['spirit-tongue'] }
			},
			{ id: 'wild-soul', name: 'Wild Soul', text: '…', requires: { level: 2 }, maxTakes: 2 },
			{ id: 'improved-stat', name: 'Improved Stat', text: '…', maxTakes: 3 },
			{ id: 'superior-stat', name: 'Superior Stat', text: '…', requires: { level: 6 } },
			{
				id: 'suck-the-poison-out',
				name: 'Suck the Poison Out',
				text: '…',
				requires: { level: 6, moves: ['healers-arts'] }
			},
			{
				id: 'reckoned-with',
				name: 'A Force to be Reckoned With',
				text: '…',
				requires: { level: 6 },
				replaces: 'into-the-lions-den'
			}
		]
	}
} as unknown as Playbook;

/** A level-1 Blessed with Spirit Tongue (fixed) + Barkskin (background) + one pick. */
const base = (over: Partial<StonetopCharacter> = {}): StonetopCharacter => ({
	...createCharacter('the-blessed'),
	backgroundId: 'initiate',
	moves: ['spirit-tongue', 'healers-arts'],
	...over
});

describe('timesTaken / maxTakes / isMaxedOut', () => {
	it('counts a creation move once', () => {
		expect(timesTaken(base(), playbook, 'spirit-tongue')).toBe(1);
		expect(timesTaken(base(), playbook, 'barkskin')).toBe(1); // background grant
		expect(timesTaken(base(), playbook, 'improved-stat')).toBe(0);
	});

	it('adds advancement takes', () => {
		const c = base({
			advancement: [
				{ level: 2, moveId: 'improved-stat', stat: 'STR' },
				{ level: 3, moveId: 'improved-stat', stat: 'DEX' }
			]
		});
		expect(timesTaken(c, playbook, 'improved-stat')).toBe(2);
		expect(maxTakes(playbook.moves.list.find((m) => m.id === 'improved-stat')!)).toBe(3);
		expect(
			isMaxedOut(
				c,
				playbook,
				playbook.moves.list.find((m) => m.id === 'improved-stat')!
			)
		).toBe(false);
	});

	it('reports a single-take move as maxed once held', () => {
		const healers = playbook.moves.list.find((m) => m.id === 'healers-arts')!;
		expect(isMaxedOut(base(), playbook, healers)).toBe(true);
	});
});

describe('meetsLevel', () => {
	it('honours the level gate, default 1', () => {
		const wild = playbook.moves.list.find((m) => m.id === 'wild-soul')!;
		const barkskin = playbook.moves.list.find((m) => m.id === 'barkskin')!;
		expect(meetsLevel(wild, 1)).toBe(false);
		expect(meetsLevel(wild, 2)).toBe(true);
		expect(meetsLevel(barkskin, 1)).toBe(true);
	});
});

describe('levelUpChoices', () => {
	it('offers level-2 moves when reaching level 2, but not level-6 ones', () => {
		const ids = levelUpChoices(base(), playbook).map((m) => m.id);
		expect(ids).toContain('wild-soul'); // level 2, now reachable
		expect(ids).toContain('improved-stat'); // repeatable, no gate
		expect(ids).toContain('into-the-lions-den'); // ungated, not yet held
		expect(ids).not.toContain('superior-stat'); // level 6
		expect(ids).not.toContain('suck-the-poison-out'); // level 6
		expect(ids).not.toContain('healers-arts'); // already held (maxed)
		expect(ids).not.toContain('spirit-tongue'); // granted (maxed)
	});

	it('gates a level-6 move on both its level and its prerequisite move', () => {
		// At level 5 → reaching 6: healers-arts is held, so suck-the-poison-out opens.
		const ids = levelUpChoices(base({ level: 5 }), playbook).map((m) => m.id);
		expect(ids).toContain('suck-the-poison-out');
		expect(ids).toContain('superior-stat');
	});

	it('withholds a prereq-gated level-6 move when the prerequisite is absent', () => {
		const c = base({ level: 5, moves: ['spirit-tongue'] }); // no healers-arts
		const ids = levelUpChoices(c, playbook).map((m) => m.id);
		expect(ids).not.toContain('suck-the-poison-out');
	});

	it('offers a childOf move once its parent is held', () => {
		// spirit-tongue is a fixed starting move, so its child is always eligible.
		expect(levelUpChoices(base(), playbook).map((m) => m.id)).toContain('call-the-spirits');
	});

	it('legalChoices takes an explicit target level', () => {
		// Directly at level 6, superior-stat and the level-6 replacement open up.
		const holding = base({ moves: ['spirit-tongue', 'into-the-lions-den'] });
		const ids = legalChoices(holding, playbook, 6).map((m) => m.id);
		expect(ids).toContain('superior-stat');
		expect(ids).toContain('reckoned-with');
		expect(legalChoices(holding, playbook, 1).map((m) => m.id)).not.toContain('superior-stat');
	});

	it('offers a replacement only while the move it replaces is held', () => {
		const holding = base({ level: 5, moves: ['spirit-tongue', 'into-the-lions-den'] });
		expect(levelUpChoices(holding, playbook).map((m) => m.id)).toContain('reckoned-with');
		const without = base({ level: 5, moves: ['spirit-tongue'] });
		expect(levelUpChoices(without, playbook).map((m) => m.id)).not.toContain('reckoned-with');
	});

	it('stops offering a repeatable move once its cap is reached', () => {
		const c = base({
			advancement: [
				{ level: 2, moveId: 'improved-stat', stat: 'STR' },
				{ level: 3, moveId: 'improved-stat', stat: 'DEX' },
				{ level: 4, moveId: 'improved-stat', stat: 'CON' }
			],
			level: 4
		});
		expect(levelUpChoices(c, playbook).map((m) => m.id)).not.toContain('improved-stat');
	});
});

describe('applyLevelUp', () => {
	it('refuses without enough XP', () => {
		const r = applyLevelUp(base({ xp: 7 }), playbook, { moveId: 'wild-soul' });
		expect(r).toEqual({ ok: false, reason: 'not-enough-xp' });
	});

	it('refuses an unknown or illegal move', () => {
		const c = base({ xp: 8 });
		expect(applyLevelUp(c, playbook, { moveId: 'nope' })).toEqual({
			ok: false,
			reason: 'unknown-move'
		});
		// superior-stat is level 6, illegal when reaching level 2
		expect(applyLevelUp(c, playbook, { moveId: 'superior-stat' })).toEqual({
			ok: false,
			reason: 'illegal-choice'
		});
	});

	it('spends the XP cost, gains a level, and records the pick', () => {
		const c = base({ xp: 10 }); // cost at level 1 is 6 + 2 = 8
		const r = applyLevelUp(c, playbook, { moveId: 'wild-soul' });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.character.level).toBe(2);
		expect(r.character.xp).toBe(2); // 10 − 8
		expect(r.character.advancement).toEqual([
			{ level: 2, moveId: 'wild-soul', replaced: undefined }
		]);
	});

	it('retires the replaced move and syncs a newly-gained tracker move', () => {
		const withTracker = {
			...playbook,
			moves: {
				...playbook.moves,
				list: playbook.moves.list.map((m) =>
					m.id === 'reckoned-with' ? { ...m, tracker: { boxes: 3, label: 'Rep' } } : m
				)
			}
		} as Playbook;
		const c = base({ level: 5, xp: 20, moves: ['spirit-tongue', 'into-the-lions-den'] });
		const r = applyLevelUp(c, withTracker, { moveId: 'reckoned-with' });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.character.advancement.at(-1)).toMatchObject({
			moveId: 'reckoned-with',
			replaced: 'into-the-lions-den'
		});
		// tracker for the gained move exists; the retired move is gone from held set
		expect(r.character.trackers['reckoned-with']).toEqual({ label: 'Rep', boxes: 3, marked: 0 });
	});
});

describe('advancementLog', () => {
	it('resolves move names, stat bumps, and retired moves', () => {
		const c = base({
			advancement: [
				{ level: 2, moveId: 'wild-soul' },
				{ level: 3, moveId: 'improved-stat', stat: 'STR' },
				{ level: 6, moveId: 'reckoned-with', replaced: 'into-the-lions-den' }
			]
		});
		expect(advancementLog(c, playbook)).toEqual([
			{ level: 2, moveName: 'Wild Soul', stat: undefined, replacedName: undefined },
			{ level: 3, moveName: 'Improved Stat', stat: 'STR', replacedName: undefined },
			{
				level: 6,
				moveName: 'A Force to be Reckoned With',
				stat: undefined,
				replacedName: "Into the Lion's Den"
			}
		]);
	});

	it('is empty for a fresh character', () => {
		expect(advancementLog(base(), playbook)).toEqual([]);
	});
});

describe('migrateCharacter', () => {
	it('fills advancement and stamps the current version on a v1 blob', () => {
		const v1 = { ...createCharacter('the-blessed'), schemaVersion: 1 } as Record<string, unknown>;
		delete v1.advancement;
		const migrated = migrateCharacter(v1);
		expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
		expect(migrated.advancement).toEqual([]);
		expect(migrated.playbookId).toBe('the-blessed');
	});

	it('is idempotent on a current character', () => {
		const c = base();
		expect(migrateCharacter(c)).toEqual(c);
	});

	it('tolerates an empty blob', () => {
		const migrated = migrateCharacter({});
		expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
		expect(migrated.advancement).toEqual([]);
		expect(migrated.playbookId).toBeNull();
	});

	// v3 (commit 99) adds `inserts`. A v2 blob predates the field entirely, so
	// migrating it is a one-time event: the character gets seeded with
	// whatever it already qualifies for automatically, same as if it had
	// been re-saved the moment auto-attach landed.
	describe('v2 -> v3 (inserts)', () => {
		it('a saved Lightbearer wakes up with Invocations attached', () => {
			const v2 = { ...createCharacter('the-lightbearer'), schemaVersion: 2 } as Record<
				string,
				unknown
			>;
			delete v2.inserts;
			const migrated = migrateCharacter(v2);
			expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
			expect(migrated.inserts).toEqual({ 'insert-invocations': {} });
		});

		it('a v2 blob that qualifies for nothing gets an empty inserts map', () => {
			const v2 = { ...createCharacter('the-heavy'), schemaVersion: 2 } as Record<string, unknown>;
			delete v2.inserts;
			expect(migrateCharacter(v2).inserts).toEqual({});
		});

		it('does not re-run auto-attach on a blob that already has inserts', () => {
			// A Lightbearer who detached Invocations themselves — an `inserts`
			// field already present (even empty) means this isn't the v2->v3
			// migration anymore, so their removal is respected on reload.
			const current = { ...createCharacter('the-lightbearer'), inserts: {} };
			expect(migrateCharacter(current).inserts).toEqual({});
		});
	});

	// v4 (phase 21) turns per-stat `debilitated` flags into the book's three
	// conditions and strips the flag from the stored stat shape.
	describe('v3 -> v4 (debilities)', () => {
		it('folds per-stat flags into their pair condition and strips them', () => {
			const v3 = {
				...createCharacter('the-blessed'),
				schemaVersion: 3,
				stats: {
					STR: { value: 2, debilitated: true },
					DEX: { value: 1, debilitated: false },
					WIS: { value: 0, debilitated: true }
				}
			} as Record<string, unknown>;
			delete v3.debilities;
			const migrated = migrateCharacter(v3);
			expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
			// STR marked ⇒ weakened; WIS marked ⇒ dazed; CON/CHA untouched.
			expect(migrated.debilities).toEqual({ weakened: true, dazed: true, miserable: false });
			// The flag leaves the stored shape; values survive.
			expect(migrated.stats).toEqual({
				STR: { value: 2 },
				DEX: { value: 1 },
				WIS: { value: 0 }
			});
		});

		it('a clean v3 blob migrates to no debilities', () => {
			const v3 = {
				...createCharacter('the-heavy'),
				schemaVersion: 3,
				stats: { STR: { value: 2, debilitated: false } }
			} as Record<string, unknown>;
			delete v3.debilities;
			expect(migrateCharacter(v3).debilities).toEqual({
				weakened: false,
				dazed: false,
				miserable: false
			});
		});

		it('respects an already-migrated debilities field', () => {
			const current = {
				...createCharacter('the-blessed'),
				debilities: { weakened: false, dazed: false, miserable: true }
			};
			expect(migrateCharacter(current).debilities).toEqual({
				weakened: false,
				dazed: false,
				miserable: true
			});
		});
	});
});
