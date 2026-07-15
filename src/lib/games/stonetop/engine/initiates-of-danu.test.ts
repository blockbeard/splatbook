import { describe, expect, it } from 'vitest';
import type { InitiateEntry } from './initiates-of-danu';
import { createCharacter } from './character';
import {
	attachInitiatesOfDanu,
	hasInitiatesOfDanuInsert,
	initiatePicksOf,
	pickInitiate,
	setInitiateChoice,
	setInitiateHp,
	setInitiateLoyalty,
	unpickInitiate
} from './initiates-of-danu';

const enfys = { id: 'enfys', name: 'Enfys, the acolyte', hp: 6 } as unknown as InitiateEntry;
const olwin = {
	id: 'olwin',
	name: 'Olwin, your anointed lover',
	hp: 6
} as unknown as InitiateEntry;

describe('attachInitiatesOfDanu', () => {
	it('attaches with nobody picked', () => {
		const c = attachInitiatesOfDanu(createCharacter('the-blessed'));
		expect(hasInitiatesOfDanuInsert(c)).toBe(true);
		expect(initiatePicksOf(c)).toEqual({});
	});
});

describe('hasInitiatesOfDanuInsert / initiatePicksOf', () => {
	it('is false and empty before attaching', () => {
		const c = createCharacter('the-blessed');
		expect(hasInitiatesOfDanuInsert(c)).toBe(false);
		expect(initiatePicksOf(c)).toEqual({});
	});
});

describe('pickInitiate', () => {
	it('adds a pick seeded from the catalogue HP', () => {
		const c = pickInitiate(attachInitiatesOfDanu(createCharacter('the-blessed')), enfys);
		expect(initiatePicksOf(c)).toEqual({ enfys: { hp: 6, loyalty: 0, choices: {} } });
	});

	it('is idempotent — picking twice keeps the existing state', () => {
		let c = attachInitiatesOfDanu(createCharacter('the-blessed'));
		c = pickInitiate(c, enfys);
		c = setInitiateHp(c, 'enfys', 3);
		c = pickInitiate(c, enfys);
		expect(initiatePicksOf(c).enfys.hp).toBe(3);
	});

	it('supports multiple picks', () => {
		let c = attachInitiatesOfDanu(createCharacter('the-blessed'));
		c = pickInitiate(c, enfys);
		c = pickInitiate(c, olwin);
		expect(Object.keys(initiatePicksOf(c)).sort()).toEqual(['enfys', 'olwin']);
	});
});

describe('unpickInitiate', () => {
	it('removes a pick', () => {
		let c = attachInitiatesOfDanu(createCharacter('the-blessed'));
		c = pickInitiate(c, enfys);
		c = unpickInitiate(c, 'enfys');
		expect(initiatePicksOf(c)).toEqual({});
	});

	it('is a no-op for someone never picked', () => {
		const before = attachInitiatesOfDanu(createCharacter('the-blessed'));
		const after = unpickInitiate(before, 'enfys');
		expect(after).toBe(before);
	});
});

describe('setInitiateHp', () => {
	it('updates HP for a picked initiate', () => {
		let c = attachInitiatesOfDanu(createCharacter('the-blessed'));
		c = pickInitiate(c, enfys);
		c = setInitiateHp(c, 'enfys', 2);
		expect(initiatePicksOf(c).enfys.hp).toBe(2);
	});

	it('is a no-op for an unpicked initiate', () => {
		const before = attachInitiatesOfDanu(createCharacter('the-blessed'));
		const after = setInitiateHp(before, 'enfys', 2);
		expect(after).toBe(before);
	});
});

describe('setInitiateLoyalty', () => {
	it('clamps to [0, max]', () => {
		let c = attachInitiatesOfDanu(createCharacter('the-blessed'));
		c = pickInitiate(c, enfys);
		expect(initiatePicksOf(setInitiateLoyalty(c, 'enfys', -1, 3)).enfys.loyalty).toBe(0);
		expect(initiatePicksOf(setInitiateLoyalty(c, 'enfys', 5, 3)).enfys.loyalty).toBe(3);
	});
});

describe('setInitiateChoice', () => {
	it('answers a flavor prompt', () => {
		let c = attachInitiatesOfDanu(createCharacter('the-blessed'));
		c = pickInitiate(c, enfys);
		c = setInitiateChoice(c, 'enfys', 'Pronouns', 'they');
		expect(initiatePicksOf(c).enfys.choices).toEqual({ Pronouns: 'they' });
	});

	it('is a no-op for an unpicked initiate', () => {
		const before = attachInitiatesOfDanu(createCharacter('the-blessed'));
		const after = setInitiateChoice(before, 'enfys', 'Pronouns', 'they');
		expect(after).toBe(before);
	});

	it('does not disturb other initiates or other choices', () => {
		let c = attachInitiatesOfDanu(createCharacter('the-blessed'));
		c = pickInitiate(c, enfys);
		c = pickInitiate(c, olwin);
		c = setInitiateChoice(c, 'enfys', 'Pronouns', 'they');
		c = setInitiateChoice(c, 'enfys', 'Age', 'a young adult');
		c = setInitiateChoice(c, 'olwin', 'Pronouns', 'she');
		expect(initiatePicksOf(c).enfys.choices).toEqual({ Pronouns: 'they', Age: 'a young adult' });
		expect(initiatePicksOf(c).olwin.choices).toEqual({ Pronouns: 'she' });
	});
});
