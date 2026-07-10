import { describe, expect, it } from 'vitest';
import { createCharacter, type StonetopCharacter } from './character';
import type { Playbook } from '../pack-schemas';
import { bumpStat, statAtCap } from './play';
import {
	applyLevelUp,
	canCrossOffWouldBe,
	crossOffWouldBe,
	holdsAsteriskMove,
	isWouldBeCrossed,
	levelUpChoices,
	trackerGateMet
} from './advancement';

/**
 * A Would-be Hero-shaped playbook exercising the phase-5 special cases:
 * Improved/Superior Stat bumps with caps, the Potential-for-Greatness tracker
 * gating Superior Stat, and an asterisk replacement move.
 */
const playbook = {
	id: 'the-would-be-hero',
	base: { damage: 'd6', maxHp: 16 },
	backgrounds: [{ id: 'plain', name: 'Plain' }],
	stats: { array: [2, 1, 1, 0, 0, -1], debilities: [] },
	moves: {
		starting: { fixed: ['anger', 'potential'], choose: 1 },
		list: [
			{ id: 'anger', name: 'Anger', text: '…' },
			{ id: 'improved-stat', name: 'Improved Stat', text: '…', maxTakes: 3, statBump: { cap: 2 } },
			{
				id: 'potential',
				name: 'Potential for Greatness',
				text: '…',
				tracker: { boxes: 6, label: 'PfG' }
			},
			{
				id: 'superior-stat',
				name: 'Superior Stat',
				text: '…',
				statBump: { cap: 3 },
				requires: { tracker: { move: 'potential', count: 6 } }
			},
			{
				id: 'undaunted',
				name: 'Undaunted',
				text: '…',
				requires: { level: 6 },
				replaces: 'anger',
				asterisk: true
			}
		]
	}
} as unknown as Playbook;

const hero = (over: Partial<StonetopCharacter> = {}): StonetopCharacter => ({
	...createCharacter('the-would-be-hero'),
	stats: {
		STR: { value: 1, debilitated: false },
		DEX: { value: 2, debilitated: false },
		CON: { value: 0, debilitated: false }
	},
	moves: ['anger', 'potential'],
	...over
});

describe('bumpStat / statAtCap', () => {
	it('raises a stat by 1, not past the cap', () => {
		const c = bumpStat(hero(), 'STR', 2)!;
		expect(c.stats.STR!.value).toBe(2);
		expect(bumpStat(c, 'STR', 2)).toBeUndefined(); // already at +2
	});

	it('reports the cap and refuses an unassigned stat', () => {
		const c = hero();
		expect(statAtCap(c, 'DEX', 2)).toBe(true); // DEX is +2
		expect(statAtCap(c, 'STR', 2)).toBe(false);
		expect(bumpStat(c, 'WIS', 2)).toBeUndefined(); // unassigned
	});
});

describe('Improved Stat', () => {
	it('requires a stat and applies a capped +1', () => {
		const c = hero({ xp: 8 }); // cost at level 1 = 8
		expect(applyLevelUp(c, playbook, { moveId: 'improved-stat' })).toEqual({
			ok: false,
			reason: 'stat-required'
		});
		const r = applyLevelUp(c, playbook, { moveId: 'improved-stat', stat: 'STR' });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.character.stats.STR!.value).toBe(2);
		expect(r.character.advancement.at(-1)).toMatchObject({ moveId: 'improved-stat', stat: 'STR' });
	});

	it('refuses to bump a stat already at its cap', () => {
		const c = hero({ xp: 8 }); // DEX is +2, cap for Improved Stat
		expect(applyLevelUp(c, playbook, { moveId: 'improved-stat', stat: 'DEX' })).toEqual({
			ok: false,
			reason: 'stat-capped'
		});
	});
});

describe('Superior Stat gated on Potential for Greatness', () => {
	it('is withheld until the tracker is full, then offered', () => {
		const short = hero({ trackers: { potential: { label: 'PfG', boxes: 6, marked: 5 } } });
		expect(levelUpChoices(short, playbook).map((m) => m.id)).not.toContain('superior-stat');

		const full = hero({ trackers: { potential: { label: 'PfG', boxes: 6, marked: 6 } } });
		expect(levelUpChoices(full, playbook).map((m) => m.id)).toContain('superior-stat');
	});

	it('trackerGateMet reads the mark count directly', () => {
		const full = hero({ trackers: { potential: { label: 'PfG', boxes: 6, marked: 6 } } });
		const superior = playbook.moves.list.find((m) => m.id === 'superior-stat')!;
		const anger = playbook.moves.list.find((m) => m.id === 'anger')!;
		expect(trackerGateMet(full, superior)).toBe(true);
		expect(trackerGateMet(hero(), superior)).toBe(false);
		expect(trackerGateMet(hero(), anger)).toBe(true); // ungated
	});

	it('raises a stat to the +3 cap when taken', () => {
		const c = hero({
			xp: 8,
			stats: { DEX: { value: 2, debilitated: false } },
			trackers: { potential: { label: 'PfG', boxes: 6, marked: 6 } }
		});
		const r = applyLevelUp(c, playbook, { moveId: 'superior-stat', stat: 'DEX' });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.character.stats.DEX!.value).toBe(3); // +2 → +3, allowed by cap 3
	});
});

describe("Would-be Hero's asterisk rule", () => {
	it('offers cross-off only once an asterisk move is held', () => {
		expect(holdsAsteriskMove(hero(), playbook)).toBe(false);
		expect(canCrossOffWouldBe(hero(), playbook)).toBe(false);

		const withAsterisk = hero({
			level: 6,
			advancement: [{ level: 6, moveId: 'undaunted', replaced: 'anger' }]
		});
		expect(holdsAsteriskMove(withAsterisk, playbook)).toBe(true);
		expect(canCrossOffWouldBe(withAsterisk, playbook)).toBe(true);
	});

	it('crosses off Would-be and stops offering it again', () => {
		const withAsterisk = hero({
			level: 6,
			advancement: [{ level: 6, moveId: 'undaunted', replaced: 'anger' }]
		});
		const crossed = crossOffWouldBe(withAsterisk);
		expect(isWouldBeCrossed(crossed)).toBe(true);
		expect(canCrossOffWouldBe(crossed, playbook)).toBe(false);
	});
});
