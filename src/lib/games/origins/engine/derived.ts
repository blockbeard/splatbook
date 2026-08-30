/**
 * Every number on an Origins character sheet, derived from the character's
 * choices and the pack.
 *
 * This is the file where the hack differs from plain 5e, and each difference is
 * marked. The temptation, reading 5e-shaped code, is to "fix" these back to the
 * familiar rules; the pack test and this file's tests exist to stop that.
 *
 * - **Proficiency bonus is fixed** (2, from the pack). There are no levels.
 * - **Saving throws have no proficiency at all.** A reference class grants Hit
 *   Point Die, Armor Training, Shields and Weapon Proficiencies — that list is
 *   exhaustive, and saving throws are not on it.
 * - **Hit points are rolled**, not maximised at level 1.
 * - **Starting gold on Option B is 100 or 150**, not the SRD's 50.
 */

import type {
	Ability,
	Armor,
	Background,
	Equipment,
	OriginsRules,
	ReferenceClass,
	ReferenceData,
	Skill,
	Species
} from '../pack-schemas';
import { abilityModifier } from './abilities';
import type { OriginsCharacter } from './character';
import { skillProficiencyIds } from './proficiencies';

/** Everything the derivations need from the pack, in one bag. */
export interface PackContext {
	rules: OriginsRules;
	reference: ReferenceData;
	equipment: Equipment;
	background: Background | null;
	referenceClass: ReferenceClass | null;
	/** Needed because a species choice can grant a skill (Elf's Keen Senses,
	 * Human's Skillful), and skill proficiency is derived, not stored. */
	species: Species | null;
}

/** Fixed for every Origins character: no levels, nothing to scale with. */
export function proficiencyBonus(rules: OriginsRules): number {
	return rules.rules.proficiencyBonus;
}

// --- Armor Class ----------------------------------------------------------

/**
 * AC from worn armor, the Dexterity modifier the armor allows, and a shield.
 *
 * Unarmored is 10 + DEX. Body armor sets the base and may cap DEX (or ignore it
 * entirely, for Heavy). A shield adds its bonus on top of either.
 */
export function armorClass(character: OriginsCharacter, ctx: PackContext): number {
	const dex = abilityModifier(character, 'DEX');
	const armor = character.equipment.armorId
		? (ctx.equipment.armor.find((a) => a.id === character.equipment.armorId) ?? null)
		: null;

	let base = 10 + dex;
	if (armor && armor.baseAc !== null) {
		const dexPart = armor.addsDex ? (armor.dexCap === null ? dex : Math.min(dex, armor.dexCap)) : 0;
		base = armor.baseAc + dexPart;
	}

	const shield = ctx.equipment.armor.find((a) => a.category === 'Shield');
	return base + (character.equipment.shield ? (shield?.acBonus ?? 0) : 0);
}

/** Whether the character may wear a piece of armor, given the reference class's
 * Armor Training. Wearing armor you lack training in is legal but bad in 5e;
 * the builder warns rather than forbids, which is why this is a predicate. */
export function isTrainedFor(armor: Armor, referenceClass: ReferenceClass | null): boolean {
	if (!referenceClass) return false;
	const training = referenceClass.armorTraining;
	switch (armor.category) {
		case 'Light':
			return training.light;
		case 'Medium':
			return training.medium;
		case 'Heavy':
			return training.heavy;
		case 'Shield':
			return training.shields;
	}
}

// --- Hit points -----------------------------------------------------------

/**
 * Maximum hit points: the rolled hit die plus the CON modifier.
 *
 * Origins says "roll your Hit Die and add your CON bonus" — *not* 5e's
 * take-the-maximum at level 1. Null until the die is rolled. Floored at 1: a
 * character with a bad roll and a bad Constitution still gets to exist.
 */
export function maxHitPoints(character: OriginsCharacter): number | null {
	const rolled = character.hitPoints.rolled;
	if (rolled === null) return null;
	return Math.max(1, rolled + abilityModifier(character, 'CON'));
}

/** The hit die the reference class lends, e.g. 12 for a Barbarian. */
export function hitDie(ctx: PackContext): number | null {
	return ctx.referenceClass?.hitDie ?? null;
}

// --- Saving throws --------------------------------------------------------

/**
 * A saving throw is the bare ability modifier.
 *
 * **No proficiency, ever.** Saving-throw proficiency comes from a class in 5e,
 * and an Origins character has no class — the reference class lends four
 * things, and this is not one of them. `referenceClass.notGranted` carries the
 * proficiencies it would have given, purely so the sheet can show a player what
 * they are not getting.
 */
export function savingThrow(character: OriginsCharacter, ability: Ability): number {
	return abilityModifier(character, ability);
}

// --- Skills ---------------------------------------------------------------

/**
 * Is the character proficient in this skill?
 *
 * Derived from the background and the species choices rather than read off the
 * character — see `proficiencies.ts` for why.
 */
export function hasSkill(character: OriginsCharacter, skill: Skill, ctx: PackContext): boolean {
	return skillProficiencyIds(character, ctx).has(skill.id);
}

/** A skill check modifier: the governing ability, plus proficiency if trained. */
export function skillModifier(character: OriginsCharacter, skill: Skill, ctx: PackContext): number {
	const base = abilityModifier(character, skill.ability);
	return base + (hasSkill(character, skill, ctx) ? proficiencyBonus(ctx.rules) : 0);
}

/** Passive Perception: 10 + the Perception modifier. */
export function passivePerception(character: OriginsCharacter, ctx: PackContext): number {
	const perception = ctx.reference.skills.find((s) => s.id === 'perception');
	if (!perception) return 10;
	return 10 + skillModifier(character, perception, ctx);
}

/**
 * Initiative: the Dexterity modifier, plus the proficiency bonus if the
 * character has the Alert feat (its Initiative Proficiency benefit). Alert is
 * the Criminal background's feat, so this is a live case, not a hypothetical.
 */
export function initiative(character: OriginsCharacter, ctx: PackContext): number {
	const alert = ctx.background?.feat.id === 'alert';
	return abilityModifier(character, 'DEX') + (alert ? proficiencyBonus(ctx.rules) : 0);
}

// --- Money ----------------------------------------------------------------

/**
 * The starting gold Option B is worth, in gold.
 *
 * Origins raises the SRD's 50 GP to 100, or 150 for a character whose reference
 * class trains them in Medium or Heavy armor — the reasoning being that armor
 * is expensive and a heavily-armored character who takes the coin instead has
 * more to buy. The pack still carries the SRD's own 50; the override lives in
 * `origins-rules.json` and is applied here.
 */
export function startingGold(ctx: PackContext): number {
	const gold = ctx.rules.rules.equipment.startingGold;
	const training = ctx.referenceClass?.armorTraining;
	const heavier = Boolean(training?.medium || training?.heavy);
	return heavier ? gold.withMediumOrHeavyArmorTraining : gold.base;
}

/** Copper in a gold piece — the pack stores every cost in copper. */
export const CP_PER_GP = 100;

/** A purse in copper, rendered the way a sheet writes it: "12 GP 5 SP". */
export function formatMoney(cp: number): string {
	const gp = Math.floor(cp / CP_PER_GP);
	const sp = Math.floor((cp % CP_PER_GP) / 10);
	const rem = cp % 10;
	const parts: string[] = [];
	if (gp) parts.push(`${gp} GP`);
	if (sp) parts.push(`${sp} SP`);
	if (rem || parts.length === 0) parts.push(`${rem} CP`);
	return parts.join(' ');
}
