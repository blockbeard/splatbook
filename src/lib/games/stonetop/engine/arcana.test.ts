import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import {
	addArcanaCard,
	addArcanaSection,
	arcanaCardsOf,
	attachArcana,
	hasArcanaInsert,
	isArcanaSectionUnlocked,
	removeArcanaCard,
	removeArcanaSection,
	setArcanaMarked,
	updateArcanaCard,
	updateArcanaSection,
	type ArcanaCard
} from './arcana';

describe('attachArcana', () => {
	it('attaches with no cards', () => {
		const c = attachArcana(createCharacter(null));
		expect(hasArcanaInsert(c)).toBe(true);
		expect(arcanaCardsOf(c)).toEqual([]);
	});
});

describe('hasArcanaInsert / arcanaCardsOf', () => {
	it('is false and empty before attaching', () => {
		const c = createCharacter(null);
		expect(hasArcanaInsert(c)).toBe(false);
		expect(arcanaCardsOf(c)).toEqual([]);
	});
});

describe('addArcanaCard', () => {
	it('attaches (if needed) and appends a card with defaults', () => {
		const c = addArcanaCard(createCharacter(null));
		expect(hasArcanaInsert(c)).toBe(true);
		expect(arcanaCardsOf(c)).toEqual([
			{ name: '', notes: '', markBoxes: 3, marked: 0, sections: [] }
		]);
	});

	it('accepts an initial name and mark-box count', () => {
		const c = addArcanaCard(createCharacter(null), {
			name: 'Staff of the Lidless Orb',
			markBoxes: 5
		});
		expect(arcanaCardsOf(c)[0].name).toBe('Staff of the Lidless Orb');
		expect(arcanaCardsOf(c)[0].markBoxes).toBe(5);
	});

	it('supports multiple cards', () => {
		let c = addArcanaCard(createCharacter(null), { name: 'A' });
		c = addArcanaCard(c, { name: 'B' });
		expect(arcanaCardsOf(c).map((card) => card.name)).toEqual(['A', 'B']);
	});
});

describe('removeArcanaCard', () => {
	it('removes by index', () => {
		let c = addArcanaCard(createCharacter(null), { name: 'A' });
		c = addArcanaCard(c, { name: 'B' });
		c = removeArcanaCard(c, 0);
		expect(arcanaCardsOf(c).map((card) => card.name)).toEqual(['B']);
	});
});

describe('updateArcanaCard', () => {
	it('patches name/notes/markBoxes', () => {
		let c = addArcanaCard(createCharacter(null));
		c = updateArcanaCard(c, 0, { name: 'Twisted Spear', notes: 'reach, magical', markBoxes: 3 });
		expect(arcanaCardsOf(c)[0]).toMatchObject({
			name: 'Twisted Spear',
			notes: 'reach, magical',
			markBoxes: 3
		});
	});

	it('is a no-op out of range', () => {
		const before = addArcanaCard(createCharacter(null));
		const after = updateArcanaCard(before, 5, { name: 'nope' });
		expect(after).toBe(before);
	});
});

describe('setArcanaMarked', () => {
	it('clamps to [0, markBoxes]', () => {
		const c = addArcanaCard(createCharacter(null), { markBoxes: 3 });
		expect(arcanaCardsOf(setArcanaMarked(c, 0, -1))[0].marked).toBe(0);
		expect(arcanaCardsOf(setArcanaMarked(c, 0, 5))[0].marked).toBe(3);
		expect(arcanaCardsOf(setArcanaMarked(c, 0, 2))[0].marked).toBe(2);
	});

	it('is a no-op for an unknown card index', () => {
		const before = addArcanaCard(createCharacter(null));
		const after = setArcanaMarked(before, 9, 1);
		expect(after).toBe(before);
	});
});

describe('arcana sections', () => {
	it('adds a blank section', () => {
		let c = addArcanaCard(createCharacter(null));
		c = addArcanaSection(c, 0);
		expect(arcanaCardsOf(c)[0].sections).toEqual([{ name: '', text: '', unlockAt: 1 }]);
	});

	it('is a no-op adding a section to an unknown card', () => {
		const before = addArcanaCard(createCharacter(null));
		const after = addArcanaSection(before, 9);
		expect(after).toBe(before);
	});

	it('updates a section — the GM authoring its mystery text', () => {
		let c = addArcanaCard(createCharacter(null));
		c = addArcanaSection(c, 0);
		c = updateArcanaSection(c, 0, 0, {
			name: 'Power of the Lidless Orb',
			text: 'When you bear the staff...',
			unlockAt: 3
		});
		expect(arcanaCardsOf(c)[0].sections[0]).toEqual({
			name: 'Power of the Lidless Orb',
			text: 'When you bear the staff...',
			unlockAt: 3
		});
	});

	it('removes a section by index without disturbing others', () => {
		let c = addArcanaCard(createCharacter(null));
		c = addArcanaSection(c, 0);
		c = addArcanaSection(c, 0);
		c = updateArcanaSection(c, 0, 0, { name: 'First' });
		c = updateArcanaSection(c, 0, 1, { name: 'Second' });
		c = removeArcanaSection(c, 0, 0);
		expect(arcanaCardsOf(c)[0].sections).toEqual([{ name: 'Second', text: '', unlockAt: 1 }]);
	});

	it('does not disturb a second card', () => {
		let c = addArcanaCard(createCharacter(null), { name: 'A' });
		c = addArcanaCard(c, { name: 'B' });
		c = addArcanaSection(c, 0);
		expect(arcanaCardsOf(c)[0].sections).toHaveLength(1);
		expect(arcanaCardsOf(c)[1].sections).toHaveLength(0);
	});
});

describe('isArcanaSectionUnlocked', () => {
	it('is unlocked once marked reaches the threshold', () => {
		const card: ArcanaCard = {
			name: 'A',
			notes: '',
			markBoxes: 3,
			marked: 2,
			sections: []
		};
		expect(isArcanaSectionUnlocked(card, { name: '', text: '', unlockAt: 2 })).toBe(true);
		expect(isArcanaSectionUnlocked(card, { name: '', text: '', unlockAt: 3 })).toBe(false);
	});
});
