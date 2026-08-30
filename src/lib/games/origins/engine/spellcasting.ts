/**
 * Spellcasting, Origins-style: no slots, no preparation.
 *
 * You are a spellcaster only if your background's feat is Magic Initiate, which
 * opens exactly one of the Cleric, Druid and Wizard lists. From it you take two
 * cantrips and one level 1 spell. Cantrips are free; the level 1 spell is one
 * casting per Long Rest; anything cast as a Ritual is free too.
 *
 * That is the whole system, and it is why there is no slot table here.
 */

import type { Background, Spell, SpellList } from '../pack-schemas';
import { abilityModifier } from './abilities';
import type { OriginsCharacter } from './character';
import { proficiencyBonus, type PackContext } from './derived';

/** How many of each the Magic Initiate feat grants. From the feat's own text. */
export const CANTRIPS_GRANTED = 2;
export const LEVEL_1_SPELLS_GRANTED = 1;

/** The spell list this character's background opened, or null for a non-caster. */
export function spellList(background: Background | null): SpellList | null {
	if (!background || background.feat.id !== 'magic-initiate') return null;
	return background.feat.spellList ?? null;
}

/** Is this character a spellcaster at all? */
export function isSpellcaster(background: Background | null): boolean {
	return spellList(background) !== null;
}

/** The spells this character may choose from, at a given level. */
export function availableSpells(
	spells: readonly Spell[],
	list: SpellList | null,
	level: 0 | 1
): Spell[] {
	if (!list) return [];
	return spells.filter((s) => s.level === level && s.lists.includes(list));
}

/** Spell save DC: 8 + proficiency bonus + the spellcasting ability modifier. */
export function spellSaveDc(character: OriginsCharacter, ctx: PackContext): number | null {
	const ability = character.spells.ability;
	if (!ability) return null;
	return 8 + proficiencyBonus(ctx.rules) + abilityModifier(character, ability);
}

/** Spell attack bonus: proficiency bonus + the spellcasting ability modifier. */
export function spellAttackBonus(character: OriginsCharacter, ctx: PackContext): number | null {
	const ability = character.spells.ability;
	if (!ability) return null;
	return proficiencyBonus(ctx.rules) + abilityModifier(character, ability);
}

/**
 * Can this spell be cast right now?
 *
 * Cantrips and rituals always can. A level 1 spell can once per Long Rest, and
 * `spells.spent` is the record of which have been used.
 */
export function canCast(character: OriginsCharacter, spell: Spell): boolean {
	if (spell.level === 0 || spell.ritual) return true;
	return !character.spells.spent.includes(spell.id);
}

/** Mark a level 1 spell used. Cantrips and rituals cost nothing, so they no-op. */
export function castSpell(character: OriginsCharacter, spell: Spell): OriginsCharacter {
	if (spell.level === 0 || spell.ritual) return character;
	if (character.spells.spent.includes(spell.id)) return character;
	return {
		...character,
		spells: { ...character.spells, spent: [...character.spells.spent, spell.id] }
	};
}

/** A Long Rest returns every spent casting. */
export function longRest(character: OriginsCharacter): OriginsCharacter {
	return { ...character, spells: { ...character.spells, spent: [] } };
}
