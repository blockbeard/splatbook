/**
 * Which skills and tools a character is proficient in, and where each came from.
 *
 * These are **derived**, not stored, for the same reason every other number on
 * the sheet is: they fall out of the background and the species choices, so
 * deriving them means changing a species choice updates the sheet, and a
 * re-imported pack that fixes a background's skill list fixes every character
 * ever saved.
 *
 * `character.skills` and `character.tools` remain in the shape for
 * proficiencies that are genuinely a free pick rather than a consequence — the
 * Skilled feat's three, when the builder offers them — and are unioned in here.
 *
 * Sources are carried alongside because "why am I proficient in Perception?" is
 * a question the sheet should be able to answer.
 */

import type { ReferenceData, Skill } from '../pack-schemas';
import type { OriginsCharacter } from './character';
import type { PackContext } from './derived';

export interface Proficiency {
	/** Skill id, or the tool's own name (tools have no ids in the SRD). */
	id: string;
	name: string;
	/** Where it came from, in the player's words: "Acolyte", "Elf — Keen Senses". */
	source: string;
}

/** Resolve a skill by id *or* by display name — backgrounds name their skills
 * in prose ("Insight and Religion"), species choices store ids. */
function findSkill(reference: ReferenceData, idOrName: string): Skill | undefined {
	return reference.skills.find((s) => s.id === idOrName || s.name === idOrName);
}

/** Every skill proficiency this character has, with its source, in pack order. */
export function skillProficiencies(character: OriginsCharacter, ctx: PackContext): Proficiency[] {
	const found = new Map<string, Proficiency>();
	const add = (idOrName: string, source: string) => {
		const skill = findSkill(ctx.reference, idOrName);
		// A duplicate is not an error — a background and a species can name the
		// same skill — but the first source is the one worth showing.
		if (skill && !found.has(skill.id)) {
			found.set(skill.id, { id: skill.id, name: skill.name, source });
		}
	};

	for (const name of ctx.background?.skillProficiencies ?? []) {
		add(name, ctx.background!.name);
	}

	for (const choice of ctx.species?.choices ?? []) {
		if (choice.grants !== 'skill') continue;
		const picked = character.speciesChoices[choice.id];
		if (picked) add(picked, `${ctx.species!.name} — ${choice.trait ?? choice.label}`);
	}

	// Free picks the builder stored directly (the Skilled feat's three).
	for (const id of character.skills) add(id, 'Chosen');

	return ctx.reference.skills.filter((s) => found.has(s.id)).map((s) => found.get(s.id)!);
}

/** Just the ids, for a proficiency check. */
export function skillProficiencyIds(character: OriginsCharacter, ctx: PackContext): Set<string> {
	return new Set(skillProficiencies(character, ctx).map((p) => p.id));
}

/** Tool proficiencies, with their sources. */
export function toolProficiencies(character: OriginsCharacter, ctx: PackContext): Proficiency[] {
	const out: Proficiency[] = [];
	if (ctx.background) {
		out.push({
			id: ctx.background.toolProficiency,
			name: ctx.background.toolProficiency,
			source: ctx.background.name
		});
	}
	for (const name of character.tools) out.push({ id: name, name, source: 'Chosen' });
	return out;
}
