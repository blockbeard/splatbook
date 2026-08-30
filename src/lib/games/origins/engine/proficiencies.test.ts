/**
 * Skill and tool proficiency, derived.
 *
 * These tests exist because the first working build of the sheet showed an
 * Acolyte with no proficiency in Insight or Religion: the builder rendered the
 * background's skills but never applied them, so every skill modifier on the
 * sheet was wrong. Deriving them from the background and species choices — the
 * same discipline as every other number — is the fix, and this is the guard.
 */

import { describe, expect, it } from 'vitest';
import { createCharacter, type OriginsCharacter } from './character';
import { hasSkill, skillModifier, passivePerception, type PackContext } from './derived';
import {
	background,
	equipment,
	reference,
	referenceClass,
	rules,
	skill,
	speciesById
} from './fixtures';
import { skillProficiencies, toolProficiencies } from './proficiencies';

const context = (backgroundId: string | null, speciesId: string | null = null): PackContext => ({
	rules,
	reference,
	equipment,
	background: backgroundId ? background(backgroundId) : null,
	referenceClass: referenceClass('cleric'),
	species: speciesId ? speciesById(speciesId) : null
});

function acolyteElf(): OriginsCharacter {
	const c = createCharacter();
	c.backgroundId = 'acolyte';
	c.speciesId = 'elf';
	c.speciesChoices = { 'keen-senses': 'perception' };
	return c;
}

describe('skill proficiencies', () => {
	it('come from the background, by the names it writes them under', () => {
		// The background names its skills in prose ("Insight and Religion"); the
		// pack has no ids for them, so the lookup has to work by name.
		const found = skillProficiencies(acolyteElf(), context('acolyte'));
		expect(found.map((p) => p.id)).toEqual(['insight', 'religion']);
		expect(found.every((p) => p.source === 'Acolyte')).toBe(true);
	});

	it('include one granted by a species choice, and say where it came from', () => {
		const found = skillProficiencies(acolyteElf(), context('acolyte', 'elf'));
		expect(found.map((p) => p.id)).toEqual(['insight', 'perception', 'religion']);
		expect(found.find((p) => p.id === 'perception')?.source).toBe('Elf — Keen Senses');
	});

	it('ignore a species choice that grants nothing', () => {
		const c = acolyteElf();
		// The lineage and its spellcasting ability are choices, not skills.
		c.speciesChoices = { 'elven-lineage': 'wood-elf', 'elven-lineage-ability': 'WIS' };
		expect(skillProficiencies(c, context('acolyte', 'elf')).map((p) => p.id)).toEqual([
			'insight',
			'religion'
		]);
	});

	it('do not double-count a skill two sources both grant', () => {
		const c = acolyteElf();
		c.speciesChoices = { 'keen-senses': 'insight' }; // already an Acolyte skill
		const found = skillProficiencies(c, context('acolyte', 'elf'));
		expect(found.map((p) => p.id)).toEqual(['insight', 'religion']);
		// The first source wins, so the sheet says the background, not the species.
		expect(found.find((p) => p.id === 'insight')?.source).toBe('Acolyte');
	});

	it('take a free pick stored on the character', () => {
		const c = acolyteElf();
		c.skills = ['stealth'];
		const found = skillProficiencies(c, context('acolyte'));
		expect(found.map((p) => p.id)).toEqual(['insight', 'religion', 'stealth']);
		expect(found.find((p) => p.id === 'stealth')?.source).toBe('Chosen');
	});

	it('are empty before a background is picked', () => {
		expect(skillProficiencies(createCharacter(), context(null))).toEqual([]);
	});
});

describe('the modifiers that depend on them', () => {
	it('adds the proficiency bonus exactly where the character is proficient', () => {
		const c = acolyteElf();
		c.abilities.base = { STR: 10, DEX: 10, CON: 10, INT: 14, WIS: 14, CHA: 10 };
		const ctx = context('acolyte', 'elf');

		expect(hasSkill(c, skill('religion'), ctx)).toBe(true);
		expect(skillModifier(c, skill('religion'), ctx)).toBe(4); // INT +2, +2 proficiency
		expect(hasSkill(c, skill('arcana'), ctx)).toBe(false);
		expect(skillModifier(c, skill('arcana'), ctx)).toBe(2); // INT +2, untrained
	});

	it('carries a species-granted Perception into passive Perception', () => {
		const c = acolyteElf();
		c.abilities.base.WIS = 14; // +2
		// This is the case the browser found: 12 before Keen Senses applied,
		// 14 after — and it read 12 for both.
		expect(passivePerception(c, context('acolyte'))).toBe(12);
		expect(passivePerception(c, context('acolyte', 'elf'))).toBe(14);
	});
});

describe('tool proficiencies', () => {
	it('come from the background', () => {
		expect(toolProficiencies(acolyteElf(), context('acolyte'))).toEqual([
			{ id: "Calligrapher's Supplies", name: "Calligrapher's Supplies", source: 'Acolyte' }
		]);
	});
});
