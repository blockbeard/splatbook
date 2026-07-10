import { describe, expect, it } from 'vitest';
import { createCharacter, type StonetopCharacter } from './character';
import type { Playbook } from '../pack-schemas';
import {
	choosableMoves,
	freeChosenMoves,
	fullMoveSet,
	isStartable,
	pickOneSelections,
	prerequisitesMet,
	startingMovesPlan
} from './moves';

/** A playbook shaped after the Fox (pickOne) / Would-be Hero (childOf). */
const playbook = {
	backgrounds: [
		{ id: 'outsider', name: 'Outsider', grants: { moves: ['a-friend'] } },
		{ id: 'plain', name: 'Plain' }
	],
	moves: {
		starting: {
			fixed: ['anger-is-a-gift'],
			pickOne: [['ambush', 'skill-at-arms']],
			choose: 1
		},
		list: [
			{ id: 'anger-is-a-gift', name: 'Anger', text: '…' },
			{ id: 'ambush', name: 'Ambush', text: '…' },
			{ id: 'skill-at-arms', name: 'Skill at Arms', text: '…' },
			{ id: 'a-friend', name: 'A Friend', text: '…' },
			{ id: 'quick-hands', name: 'Quick Hands', text: '…' },
			{
				id: 'speak-truth',
				name: 'Speak Truth',
				text: '…',
				childOf: 'anger-is-a-gift',
				requires: { moves: ['anger-is-a-gift'] }
			},
			{ id: 'veteran', name: 'Veteran', text: '…', requires: { level: 2, note: 'the Fox' } }
		]
	}
} as unknown as Playbook;

const withBg = (moves: string[], backgroundId = 'outsider'): StonetopCharacter => ({
	...createCharacter('the-fox'),
	backgroundId,
	moves
});

describe('startingMovesPlan', () => {
	it('collects fixed, background grants, pickOne groups, and choose count', () => {
		const plan = startingMovesPlan(withBg([]), playbook);
		expect(plan.fixed).toEqual(['anger-is-a-gift']);
		expect(plan.background).toEqual(['a-friend']);
		expect(plan.pickOneGroups).toEqual([['ambush', 'skill-at-arms']]);
		expect(plan.chooseCount).toBe(1);
		expect(plan.granted.sort()).toEqual(['a-friend', 'anger-is-a-gift']);
	});

	it('has no background grants when the plain background is chosen', () => {
		expect(startingMovesPlan(withBg([], 'plain'), playbook).background).toEqual([]);
	});
});

describe('pickOneSelections / freeChosenMoves', () => {
	it('separates a pickOne pick from a free pick', () => {
		const plan = startingMovesPlan(withBg(['ambush', 'quick-hands']), playbook);
		const c = withBg(['ambush', 'quick-hands']);
		expect(pickOneSelections(c, plan)).toEqual(['ambush']);
		expect(freeChosenMoves(c, plan)).toEqual(['quick-hands']);
	});
});

describe('isStartable', () => {
	it('rejects level-2+ moves, accepts the rest', () => {
		const veteran = playbook.moves.list.find((m) => m.id === 'veteran')!;
		const ambush = playbook.moves.list.find((m) => m.id === 'ambush')!;
		expect(isStartable(veteran)).toBe(false);
		expect(isStartable(ambush)).toBe(true);
	});
});

describe('prerequisitesMet', () => {
	const speak = playbook.moves.list.find((m) => m.id === 'speak-truth')!;
	it('needs its parent move present', () => {
		expect(prerequisitesMet(speak, new Set())).toBe(false);
		expect(prerequisitesMet(speak, new Set(['anger-is-a-gift']))).toBe(true);
	});
});

describe('choosableMoves', () => {
	it('excludes granted, pickOne, and level-gated moves', () => {
		const ids = choosableMoves(withBg([]), playbook).map((m) => m.id);
		expect(ids).not.toContain('anger-is-a-gift'); // fixed
		expect(ids).not.toContain('a-friend'); // background
		expect(ids).not.toContain('ambush'); // pickOne
		expect(ids).not.toContain('veteran'); // level 2
		expect(ids).toContain('quick-hands');
		expect(ids).toContain('speak-truth'); // startable; prereq gating is the UI's job
	});
});

describe('fullMoveSet', () => {
	it('is granted plus chosen', () => {
		const plan = startingMovesPlan(withBg(['ambush']), playbook);
		const set = fullMoveSet(withBg(['ambush']), plan);
		expect([...set].sort()).toEqual(['a-friend', 'ambush', 'anger-is-a-gift']);
	});
});
