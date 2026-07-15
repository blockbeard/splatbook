import { describe, expect, it } from 'vitest';
import type { CrewInsert } from '../pack-schemas';
import { createCharacter } from './character';
import {
	addCrewIndividual,
	attachCrew,
	crewOf,
	hasCrewInsert,
	removeCrewIndividual,
	setCrewGearLine,
	setCrewLoyalty,
	setCrewTagWriteIn,
	toggleCrewSpecialTag,
	toggleCrewTag,
	updateCrew,
	updateCrewIndividual
} from './crew';

const insert = {
	tags: { writeIn: 3 },
	inventory: { writeIns: { lines: [1, 1, 1, 2, 2, 2] } },
	individuals: { portraitBoxes: 2 }
} as unknown as CrewInsert;

describe('attachCrew', () => {
	it('attaches with write-ins shaped by the insert', () => {
		const c = attachCrew(createCharacter('the-marshal'), insert);
		expect(hasCrewInsert(c)).toBe(true);
		const state = crewOf(c);
		expect(state.tagsWriteIn).toEqual(['', '', '']);
		expect(state.gear).toEqual(['', '', '', '', '', '']);
		expect(state.individuals).toEqual([]);
	});
});

describe('hasCrewInsert / crewOf', () => {
	it('is false and blank before attaching', () => {
		const c = createCharacter('the-marshal');
		expect(hasCrewInsert(c)).toBe(false);
		expect(crewOf(c).tags).toEqual([]);
	});
});

describe('toggleCrewTag', () => {
	it('adds then removes a tag', () => {
		let c = attachCrew(createCharacter('the-marshal'), insert);
		c = toggleCrewTag(c, 'brave');
		expect(crewOf(c).tags).toEqual(['brave']);
		c = toggleCrewTag(c, 'brave');
		expect(crewOf(c).tags).toEqual([]);
	});
});

describe('toggleCrewSpecialTag', () => {
	it('adds then removes a special tag', () => {
		let c = attachCrew(createCharacter('the-marshal'), insert);
		c = toggleCrewSpecialTag(c, 'exceptional');
		expect(crewOf(c).specialTags).toEqual(['exceptional']);
		c = toggleCrewSpecialTag(c, 'exceptional');
		expect(crewOf(c).specialTags).toEqual([]);
	});
});

describe('setCrewTagWriteIn', () => {
	it('writes into one slot without disturbing the others', () => {
		let c = attachCrew(createCharacter('the-marshal'), insert);
		c = setCrewTagWriteIn(c, 1, 'stubborn');
		expect(crewOf(c).tagsWriteIn).toEqual(['', 'stubborn', '']);
	});

	it('is a no-op out of range', () => {
		const before = attachCrew(createCharacter('the-marshal'), insert);
		const after = setCrewTagWriteIn(before, 99, 'stubborn');
		expect(after).toBe(before);
	});
});

describe('setCrewGearLine', () => {
	it('writes into one line', () => {
		let c = attachCrew(createCharacter('the-marshal'), insert);
		c = setCrewGearLine(c, 2, 'Extra rope');
		expect(crewOf(c).gear[2]).toBe('Extra rope');
	});
});

describe('updateCrew', () => {
	it('patches instinct/cost/notes', () => {
		const c = updateCrew(attachCrew(createCharacter('the-marshal'), insert), {
			instinct: 'To take needless risks',
			cost: 'Wealth gained',
			notes: 'Loyal to a fault'
		});
		expect(crewOf(c).instinct).toBe('To take needless risks');
		expect(crewOf(c).cost).toBe('Wealth gained');
		expect(crewOf(c).notes).toBe('Loyal to a fault');
	});
});

describe('setCrewLoyalty', () => {
	it('clamps to [0, max]', () => {
		const c = attachCrew(createCharacter('the-marshal'), insert);
		expect(crewOf(setCrewLoyalty(c, -1, 3)).loyalty).toBe(0);
		expect(crewOf(setCrewLoyalty(c, 5, 3)).loyalty).toBe(3);
	});
});

describe('crew individuals', () => {
	it('adds up to the portrait cap and no further', () => {
		let c = attachCrew(createCharacter('the-marshal'), insert);
		c = addCrewIndividual(c, insert);
		c = addCrewIndividual(c, insert);
		expect(crewOf(c).individuals).toHaveLength(2);
		c = addCrewIndividual(c, insert);
		expect(crewOf(c).individuals).toHaveLength(2);
	});

	it('updates and removes an individual', () => {
		let c = attachCrew(createCharacter('the-marshal'), insert);
		c = addCrewIndividual(c, insert);
		c = updateCrewIndividual(c, 0, { name: 'Aled', tag: 'gambler' });
		expect(crewOf(c).individuals[0]).toEqual({ name: 'Aled', tag: 'gambler', traits: '' });
		c = removeCrewIndividual(c, 0);
		expect(crewOf(c).individuals).toEqual([]);
	});
});
