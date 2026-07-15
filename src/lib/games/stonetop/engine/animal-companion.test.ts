import { describe, expect, it } from 'vitest';
import type { AnimalCompanionInsert } from '../pack-schemas';
import { createCharacter } from './character';
import {
	addBeastOfLegendPick,
	animalCompanionOf,
	attachAnimalCompanion,
	hasAnimalCompanionInsert,
	removeBeastOfLegendPick,
	setAnimalCompanionLoyalty,
	setAnimalCompanionType,
	toggleAnimalCompanionTrait,
	updateAnimalCompanion
} from './animal-companion';

const insert = {
	types: [
		{
			id: 'predator',
			name: 'Predator',
			hp: 8,
			armor: 0,
			damage: 'd8',
			damageTags: ['hand', 'grabby'],
			startingTraits: ['fierce'],
			pick: 3,
			options: ['agile', 'climber', 'clever']
		},
		{
			id: 'steed',
			name: 'Steed',
			hp: 12,
			armor: 0,
			damage: 'd6+1',
			damageTags: ['hand', 'close'],
			startingTraits: ['large'],
			pick: 4,
			options: ['aggressive', 'agile']
		}
	]
} as unknown as AnimalCompanionInsert;

describe('attachAnimalCompanion', () => {
	it('attaches with no type chosen', () => {
		const c = attachAnimalCompanion(createCharacter('the-ranger'));
		expect(hasAnimalCompanionInsert(c)).toBe(true);
		expect(animalCompanionOf(c).typeId).toBeNull();
	});
});

describe('hasAnimalCompanionInsert / animalCompanionOf', () => {
	it('is false and blank before attaching', () => {
		const c = createCharacter('the-ranger');
		expect(hasAnimalCompanionInsert(c)).toBe(false);
		expect(animalCompanionOf(c).typeId).toBeNull();
	});
});

describe('setAnimalCompanionType', () => {
	it('seeds base stats from the chosen type', () => {
		const c = setAnimalCompanionType(
			attachAnimalCompanion(createCharacter('the-ranger')),
			insert,
			'predator'
		);
		const state = animalCompanionOf(c);
		expect(state.typeId).toBe('predator');
		expect(state.hp).toBe(8);
		expect(state.maxHp).toBe(8);
		expect(state.damage).toBe('d8');
		expect(state.damageTags).toBe('hand, grabby');
	});

	it('is a no-op for an unknown type id', () => {
		const before = attachAnimalCompanion(createCharacter('the-ranger'));
		const after = setAnimalCompanionType(before, insert, 'dragon');
		expect(after).toBe(before);
	});

	it('re-picking a type resets traits but keeps name/instinct/loyalty', () => {
		let c = attachAnimalCompanion(createCharacter('the-ranger'));
		c = setAnimalCompanionType(c, insert, 'predator');
		c = updateAnimalCompanion(c, { name: 'Fang', instinct: 'To give chase' });
		c = toggleAnimalCompanionTrait(c, 'agile');
		c = setAnimalCompanionLoyalty(c, 2, 3);
		c = setAnimalCompanionType(c, insert, 'steed');
		const state = animalCompanionOf(c);
		expect(state.typeId).toBe('steed');
		expect(state.hp).toBe(12);
		expect(state.traits).toEqual([]);
		expect(state.name).toBe('Fang');
		expect(state.instinct).toBe('To give chase');
		expect(state.loyalty).toBe(2);
	});
});

describe('updateAnimalCompanion', () => {
	it('patches simple fields', () => {
		const c = updateAnimalCompanion(attachAnimalCompanion(createCharacter('the-ranger')), {
			name: 'Fang',
			notes: 'Loves rabbits'
		});
		expect(animalCompanionOf(c).name).toBe('Fang');
		expect(animalCompanionOf(c).notes).toBe('Loves rabbits');
	});
});

describe('toggleAnimalCompanionTrait', () => {
	it('adds then removes a trait', () => {
		let c = attachAnimalCompanion(createCharacter('the-ranger'));
		c = toggleAnimalCompanionTrait(c, 'agile');
		expect(animalCompanionOf(c).traits).toEqual(['agile']);
		c = toggleAnimalCompanionTrait(c, 'agile');
		expect(animalCompanionOf(c).traits).toEqual([]);
	});
});

describe('setAnimalCompanionLoyalty', () => {
	it('clamps to [0, max]', () => {
		const c = attachAnimalCompanion(createCharacter('the-ranger'));
		expect(animalCompanionOf(setAnimalCompanionLoyalty(c, -1, 3)).loyalty).toBe(0);
		expect(animalCompanionOf(setAnimalCompanionLoyalty(c, 5, 3)).loyalty).toBe(3);
		expect(animalCompanionOf(setAnimalCompanionLoyalty(c, 2, 3)).loyalty).toBe(2);
	});
});

describe('beast of legend picks', () => {
	it('adds and removes logged picks', () => {
		let c = attachAnimalCompanion(createCharacter('the-ranger'));
		c = addBeastOfLegendPick(c, 'They are exceptional');
		c = addBeastOfLegendPick(c, 'They get +4 HP and +1 armor');
		expect(animalCompanionOf(c).beastOfLegend).toEqual([
			'They are exceptional',
			'They get +4 HP and +1 armor'
		]);
		c = removeBeastOfLegendPick(c, 0);
		expect(animalCompanionOf(c).beastOfLegend).toEqual(['They get +4 HP and +1 armor']);
	});
});
