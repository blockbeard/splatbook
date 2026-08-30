/**
 * Is this draft finishable, and what is still open?
 *
 * One place answers both questions, so the wizard's review step, its progress
 * rail, and the "finish" button can never disagree about whether a character is
 * done. Each open item names the wizard step that closes it, so the review
 * screen can link straight there.
 */

import type { Background, OriginsRules, Species } from '../pack-schemas';
import { baseScoresAreLegal, increasesAreLegal } from './abilities';
import type { OriginsCharacter } from './character';
import { isSpellcaster, CANTRIPS_GRANTED, LEVEL_1_SPELLS_GRANTED } from './spellcasting';

export interface OpenChoice {
	/** The wizard step that closes this. */
	stepId: string;
	/** What is missing, in the player's words. */
	message: string;
}

export interface ValidationContext {
	rules: OriginsRules;
	background: Background | null;
	species: Species | null;
}

/** Everything still to decide, in wizard order. Empty means the draft is done. */
export function openChoices(character: OriginsCharacter, ctx: ValidationContext): OpenChoice[] {
	const open: OpenChoice[] = [];
	const add = (stepId: string, message: string) => open.push({ stepId, message });

	if (!character.backgroundId) add('background', 'Pick a background.');
	if (!character.referenceClassId) {
		add('background', 'Pick a reference class to borrow your hit die and training from.');
	}

	if (!character.speciesId) add('species', 'Pick a species.');
	for (const choice of ctx.species?.choices ?? []) {
		if (!character.speciesChoices[choice.id]) add('species', `Choose: ${choice.label}.`);
	}

	if (!character.abilities.method) {
		add('abilities', 'Choose how to determine your ability scores.');
	} else if (!baseScoresAreLegal(character, ctx.rules)) {
		add('abilities', 'Assign all six ability scores.');
	}
	if (
		ctx.background &&
		!increasesAreLegal(character.abilities.increases, ctx.background.abilityScores)
	) {
		add('abilities', 'Apply your background’s increases: +2 and +1, or +1 to all three.');
	}
	if (character.hitPoints.rolled === null) add('abilities', 'Roll your hit die for hit points.');

	if (!character.equipment.optionId) add('equipment', 'Choose your starting equipment.');

	if (isSpellcaster(ctx.background)) {
		const { cantrips, level1, ability } = character.spells;
		if (cantrips.length < CANTRIPS_GRANTED) {
			add('spells', `Choose ${CANTRIPS_GRANTED} cantrips.`);
		}
		if (level1.length < LEVEL_1_SPELLS_GRANTED) {
			add('spells', `Choose ${LEVEL_1_SPELLS_GRANTED} level 1 spell.`);
		}
		if (!ability) add('spells', 'Choose your spellcasting ability.');
	}

	const wanted = ctx.rules.rules.languages.count;
	if (character.languages.length < wanted) {
		add('details', `Choose ${wanted} languages.`);
	}
	if (!character.name.trim()) add('details', 'Name your character.');

	return open;
}

/** A draft with nothing left open is finishable. */
export function isComplete(character: OriginsCharacter, ctx: ValidationContext): boolean {
	return openChoices(character, ctx).length === 0;
}
