import { describe, expect, it } from 'vitest';
import { createCharacter } from './character';
import type { PackContext } from './derived';
import { background, equipment, reference, referenceClass, rules, spell, spells } from './fixtures';
import {
	availableSpells,
	canCast,
	castSpell,
	isSpellcaster,
	longRest,
	spellAttackBonus,
	spellList,
	spellSaveDc
} from './spellcasting';

const ctx = (backgroundId: string): PackContext => ({
	rules,
	reference,
	equipment,
	background: background(backgroundId),
	referenceClass: referenceClass('cleric')
});

describe('who is a spellcaster', () => {
	it('is decided by the background’s feat, and nothing else', () => {
		// Magic Initiate is the whole test: no class, so no class casting.
		expect(isSpellcaster(background('acolyte'))).toBe(true);
		expect(spellList(background('acolyte'))).toBe('cleric');
		expect(spellList(background('sage'))).toBe('wizard');

		expect(isSpellcaster(background('criminal'))).toBe(false);
		expect(isSpellcaster(background('soldier'))).toBe(false);
		expect(spellList(null)).toBeNull();
	});

	it('offers a caster only their own list, and only through level 1', () => {
		const cantrips = availableSpells(spells, 'cleric', 0);
		const level1 = availableSpells(spells, 'cleric', 1);
		expect(cantrips.length).toBeGreaterThan(0);
		expect(level1.length).toBeGreaterThan(0);
		for (const s of [...cantrips, ...level1]) expect(s.lists, s.name).toContain('cleric');
		// A wizard-only spell must not appear on the cleric's list.
		expect(cantrips.some((s) => s.id === 'fire-bolt')).toBe(false);

		expect(availableSpells(spells, null, 0)).toEqual([]);
	});
});

describe('spell numbers', () => {
	it('are 8 + PB + ability, and PB + ability', () => {
		const c = createCharacter();
		c.abilities.base.WIS = 16; // +3
		c.spells.ability = 'WIS';
		expect(spellSaveDc(c, ctx('acolyte'))).toBe(13); // 8 + 2 + 3
		expect(spellAttackBonus(c, ctx('acolyte'))).toBe(5); // 2 + 3
	});

	it('are unavailable until the spellcasting ability is chosen', () => {
		const c = createCharacter();
		expect(spellSaveDc(c, ctx('acolyte'))).toBeNull();
		expect(spellAttackBonus(c, ctx('acolyte'))).toBeNull();
	});
});

describe('casting, without slots', () => {
	it('lets a level 1 spell be cast once, then not again until a Long Rest', () => {
		// Cure Wounds: a level 1 Cleric spell, not a ritual.
		const cure = spell('cure-wounds');
		expect(cure.level).toBe(1);
		expect(cure.ritual).toBe(false);

		let c = createCharacter();
		c.spells.level1 = [cure.id];
		expect(canCast(c, cure)).toBe(true);

		c = castSpell(c, cure);
		expect(canCast(c, cure)).toBe(false);
		expect(c.spells.spent).toEqual([cure.id]);

		// Casting again is a no-op, not a double-spend.
		expect(castSpell(c, cure).spells.spent).toEqual([cure.id]);

		c = longRest(c);
		expect(canCast(c, cure)).toBe(true);
		expect(c.spells.spent).toEqual([]);
	});

	it('never spends a cantrip', () => {
		const guidance = spell('guidance');
		expect(guidance.level).toBe(0);
		const c = castSpell(createCharacter(), guidance);
		expect(c.spells.spent).toEqual([]);
		expect(canCast(c, guidance)).toBe(true);
	});

	it('never spends a ritual — Origins casts those for free', () => {
		const ritual = spells.find((s) => s.ritual && s.level === 1)!;
		const c = castSpell(createCharacter(), ritual);
		expect(c.spells.spent).toEqual([]);
		expect(canCast(c, ritual)).toBe(true);
	});
});
