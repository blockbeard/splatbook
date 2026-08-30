import { describe, expect, it } from 'vitest';
import { createCharacter, type OriginsCharacter } from './character';
import { background, rules, speciesById } from './fixtures';
import { isComplete, openChoices, type ValidationContext } from './validation';

const ctx = (backgroundId: string | null, speciesId: string | null): ValidationContext => ({
	rules,
	background: backgroundId ? background(backgroundId) : null,
	species: speciesId ? speciesById(speciesId) : null
});

/** A finished non-caster: Criminal (Alert) / Rogue / Dwarf. Dwarf has no choices. */
function finishedCharacter(): OriginsCharacter {
	const c = createCharacter();
	c.name = 'Vess';
	c.backgroundId = 'criminal';
	c.referenceClassId = 'rogue';
	c.speciesId = 'dwarf';
	c.abilities.method = 'standard-array';
	c.abilities.base = { STR: 10, DEX: 15, CON: 14, INT: 13, WIS: 12, CHA: 8 };
	c.abilities.increases = { DEX: 2, CON: 1 }; // Criminal offers DEX, CON, INT
	c.hitPoints.rolled = 5;
	c.equipment.optionId = 'a';
	c.languages = ['Common', 'Dwarvish'];
	return c;
}

describe('openChoices', () => {
	it('lists everything a blank draft still needs', () => {
		const open = openChoices(createCharacter(), ctx(null, null));
		const messages = open.map((o) => o.message);
		expect(messages).toContain('Pick a background.');
		expect(messages).toContain('Pick a species.');
		expect(messages).toContain('Name your character.');
		// Every open item names the step that closes it, so review can link back.
		for (const o of open) expect(o.stepId, o.message).toBeTruthy();
	});

	it('is empty for a finished character', () => {
		const c = finishedCharacter();
		expect(openChoices(c, ctx('criminal', 'dwarf'))).toEqual([]);
		expect(isComplete(c, ctx('criminal', 'dwarf'))).toBe(true);
	});

	it('reopens when an ability spread stops being legal', () => {
		const c = finishedCharacter();
		c.abilities.increases = { DEX: 2, CON: 2 }; // not a legal spread
		expect(openChoices(c, ctx('criminal', 'dwarf')).map((o) => o.message)).toContain(
			'Apply your background’s increases: +2 and +1, or +1 to all three.'
		);
	});

	it('asks a species with choices to make them', () => {
		const c = finishedCharacter();
		c.speciesId = 'elf';
		const messages = openChoices(c, ctx('criminal', 'elf')).map((o) => o.message);
		expect(messages).toContain('Choose: Elven lineage.');
		expect(messages).toContain('Choose: Keen Senses skill.');

		c.speciesChoices = {
			'elven-lineage': 'wood-elf',
			'elven-lineage-ability': 'WIS',
			'keen-senses': 'perception'
		};
		expect(isComplete(c, ctx('criminal', 'elf'))).toBe(true);
	});

	it('asks a caster for spells, and never asks a non-caster', () => {
		const nonCaster = finishedCharacter();
		expect(
			openChoices(nonCaster, ctx('criminal', 'dwarf')).some((o) => o.stepId === 'spells')
		).toBe(false);

		const caster = finishedCharacter();
		caster.backgroundId = 'acolyte';
		caster.abilities.increases = { INT: 2, WIS: 1 }; // Acolyte offers INT, WIS, CHA
		const messages = openChoices(caster, ctx('acolyte', 'dwarf')).map((o) => o.message);
		expect(messages).toContain('Choose 2 cantrips.');
		expect(messages).toContain('Choose 1 level 1 spell.');
		expect(messages).toContain('Choose your spellcasting ability.');
	});

	it('asks for the reference class separately from the background', () => {
		const c = finishedCharacter();
		c.referenceClassId = null;
		expect(openChoices(c, ctx('criminal', 'dwarf')).map((o) => o.message)).toContain(
			'Pick a reference class to borrow your hit die and training from.'
		);
	});

	it('asks for the hit die roll, because Origins rolls it', () => {
		const c = finishedCharacter();
		c.hitPoints.rolled = null;
		expect(openChoices(c, ctx('criminal', 'dwarf')).map((o) => o.message)).toContain(
			'Roll your hit die for hit points.'
		);
	});

	it('asks for as many languages as the pack says', () => {
		const c = finishedCharacter();
		c.languages = ['Common'];
		expect(openChoices(c, ctx('criminal', 'dwarf')).map((o) => o.message)).toContain(
			'Choose 2 languages.'
		);
	});
});
