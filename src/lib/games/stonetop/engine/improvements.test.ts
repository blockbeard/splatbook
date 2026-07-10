/**
 * Improvement requirement logic tests. The combinators are exercised against the
 * real printed shapes: `all` (Herd of Horses), `either` + multi-box `andThen`
 * (Additional Housing), `pick` + nested `andEstablish` (Expanded Trades),
 * `either` OR `orAll` (Weapons of War), and the open-ended `each` tactic list
 * (Well-Trained Militia). Box requirements need every ◇ filled; toggles and box
 * setters are pure.
 */

import { describe, it, expect } from 'vitest';
import type { SteadingRequires } from '../pack-schemas';
import { createSteading, type ImprovementState } from './steading';
import {
	requirementGroups,
	groupSatisfied,
	requirementsMet,
	slotSatisfied,
	allSlots,
	improvementState,
	toggleRequirement,
	setRequirementBoxes,
	setImprovementCompleted
} from './improvements';

const state = (over: Partial<ImprovementState> = {}): ImprovementState => ({
	checked: [],
	boxes: {},
	completed: false,
	...over
});

describe('requirementGroups', () => {
	it('normalises an `all` block into one all-group', () => {
		const req: SteadingRequires = { all: ['A site', 'A rider', 'Some horses'] };
		const groups = requirementGroups(req);
		expect(groups).toHaveLength(1);
		expect(groups[0].kind).toBe('all');
		expect(groups[0].slots.map((s) => s.label)).toEqual(['A site', 'A rider', 'Some horses']);
	});

	it('carries box counts through on multi-box entries', () => {
		const req: SteadingRequires = {
			either: ['An engineer', 'Build on the fields'],
			andThen: [{ text: 'Pull together', boxes: 5 }]
		};
		const groups = requirementGroups(req);
		expect(groups[0].kind).toBe('either');
		expect(groups[1].label).toBe('And then');
		expect(groups[1].slots[0].boxes).toBe(5);
	});

	it('splits a pick + andEstablish into two pick-groups', () => {
		const req: SteadingRequires = {
			pick: 1,
			options: ['Harnessing', 'Raincatching', 'Mill'],
			andEstablish: { pick: 3, options: ['a', 'b', 'c', 'd', 'e', 'f'] }
		};
		const groups = requirementGroups(req);
		expect(groups.map((g) => g.kind)).toEqual(['pick', 'pick']);
		expect(groups[0].pick).toBe(1);
		expect(groups[1].pick).toBe(3);
		expect(groups[1].label).toBe('Establish');
	});

	it('adds an each-group for tactics', () => {
		const req: SteadingRequires = {
			pick: 1,
			options: ['A veteran warrior'],
			perTactic: 'For each, Pull Together',
			tactics: ['Archery', 'Cavalry', 'Formations']
		};
		const groups = requirementGroups(req);
		expect(groups.map((g) => g.kind)).toEqual(['pick', 'each']);
		expect(groups[1].label).toBe('Train tactics');
	});
});

describe('groupSatisfied', () => {
	const req: SteadingRequires = { all: ['A', 'B'] };
	const [g] = requirementGroups(req);

	it('an all-group needs every slot', () => {
		expect(groupSatisfied(state({ checked: ['all-0'] }), g)).toBe(false);
		expect(groupSatisfied(state({ checked: ['all-0', 'all-1'] }), g)).toBe(true);
	});

	it('a pick-group needs at least N', () => {
		const [pg] = requirementGroups({ pick: 2, options: ['a', 'b', 'c'] });
		expect(groupSatisfied(state({ checked: ['pick-0'] }), pg)).toBe(false);
		expect(groupSatisfied(state({ checked: ['pick-0', 'pick-2'] }), pg)).toBe(true);
	});

	it('an either-group is met by one slot or all of orAll', () => {
		const [eg] = requirementGroups({
			either: ['Buy the swords'],
			orAll: ['A smith', 'Iron ore', { text: 'Four seasons', boxes: 4 }]
		});
		// One either slot:
		expect(groupSatisfied(state({ checked: ['either-0'] }), eg)).toBe(true);
		// Or all of orAll (including the 4-box filled):
		const viaOrAll = state({
			checked: ['orall-0', 'orall-1'],
			boxes: { 'orall-2': 4 }
		});
		expect(groupSatisfied(viaOrAll, eg)).toBe(true);
		// orAll partially done is not enough on its own:
		expect(groupSatisfied(state({ checked: ['orall-0'] }), eg)).toBe(false);
	});

	it('an each-group needs at least one tactic', () => {
		const groups = requirementGroups({
			pick: 1,
			options: ['veteran'],
			tactics: ['Archery', 'Cavalry']
		});
		const each = groups[1];
		expect(groupSatisfied(state(), each)).toBe(false);
		expect(groupSatisfied(state({ checked: ['tactic-0'] }), each)).toBe(true);
	});
});

describe('slotSatisfied (boxes)', () => {
	it('needs all boxes filled', () => {
		const [g] = requirementGroups({ all: [{ text: 'Pull together', boxes: 3 }] });
		const s = g.slots[0];
		expect(slotSatisfied(state({ boxes: { [s.key]: 2 } }), s)).toBe(false);
		expect(slotSatisfied(state({ boxes: { [s.key]: 3 } }), s)).toBe(true);
	});
});

describe('requirementsMet (whole tree)', () => {
	it('Additional Housing: either + 5-box andThen', () => {
		const req: SteadingRequires = {
			either: ['An engineer', 'Build on the fields'],
			andThen: [{ text: 'Pull together', boxes: 5 }]
		};
		// Either alone: not yet.
		expect(requirementsMet(req, state({ checked: ['either-0'] }))).toBe(false);
		// Either + full box row: met.
		const done = state({ checked: ['either-0'], boxes: { 'then-0': 5 } });
		expect(requirementsMet(req, done)).toBe(true);
	});
});

describe('mutators', () => {
	it('toggles a plain requirement on and off', () => {
		let s = createSteading();
		s = toggleRequirement(s, 'inn', 'all-0');
		expect(improvementState(s, 'inn').checked).toEqual(['all-0']);
		s = toggleRequirement(s, 'inn', 'all-0');
		expect(improvementState(s, 'inn').checked).toEqual([]);
	});

	it('sets box fill, clamped to the max', () => {
		let s = createSteading();
		s = setRequirementBoxes(s, 'inn', 'then-0', 9, 2);
		expect(improvementState(s, 'inn').boxes['then-0']).toBe(2);
		s = setRequirementBoxes(s, 'inn', 'then-0', -3, 2);
		expect(improvementState(s, 'inn').boxes['then-0']).toBe(0);
	});

	it('marks an improvement complete without touching stats', () => {
		let s = createSteading();
		const before = s.stats;
		s = setImprovementCompleted(s, 'inn', true);
		expect(improvementState(s, 'inn').completed).toBe(true);
		expect(s.stats).toEqual(before);
	});
});

describe('allSlots', () => {
	it('includes both either and orAll slots', () => {
		const keys = allSlots({ either: ['x'], orAll: ['a', 'b'] }).map((s) => s.key);
		expect(keys).toEqual(['either-0', 'orall-0', 'orall-1']);
	});
});
