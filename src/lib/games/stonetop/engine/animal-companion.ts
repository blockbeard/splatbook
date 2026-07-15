/**
 * Animal Companion (Stonetop, Book I p.143), the Ranger's class insert —
 * gated behind the `animal-companion` move, not just the playbook (commit
 * 99's `autoAttachedInsertIds` checks `held.has('animal-companion')`).
 *
 * Picking a type (bird/critter/brute/predator/steed) seeds the companion's
 * base HP/armor/damage/damageTags from that type's printed stats — the
 * player then picks `type.pick` traits from its option list (plus a
 * write-in), same shape as instincts/cost. Beast of Legend is a repeatable
 * advancement pick (the move can be taken more than once); each pick is
 * logged, not just counted, since the printed options differ in effect.
 *
 * State lives at `character.inserts['insert-animal-companion']`.
 */

import type { AnimalCompanionInsert } from '../pack-schemas';
import { attachInsert } from './character';
import type { StonetopCharacter } from './character';

export const ANIMAL_COMPANION_INSERT_ID = 'insert-animal-companion';

export interface AnimalCompanionState {
	typeId: string | null;
	name: string;
	hp: number | null;
	maxHp: number | null;
	armor: number | null;
	damage: string;
	damageTags: string;
	traits: string[];
	instinct: string;
	cost: string;
	loyalty: number;
	beastOfLegend: string[];
	notes: string;
}

const blank: AnimalCompanionState = {
	typeId: null,
	name: '',
	hp: null,
	maxHp: null,
	armor: null,
	damage: '',
	damageTags: '',
	traits: [],
	instinct: '',
	cost: '',
	loyalty: 0,
	beastOfLegend: [],
	notes: ''
};

function readState(character: StonetopCharacter): AnimalCompanionState {
	const raw = character.inserts[ANIMAL_COMPANION_INSERT_ID] as
		Partial<AnimalCompanionState> | undefined;
	return {
		typeId: raw?.typeId ?? blank.typeId,
		name: raw?.name ?? blank.name,
		hp: raw?.hp ?? blank.hp,
		maxHp: raw?.maxHp ?? blank.maxHp,
		armor: raw?.armor ?? blank.armor,
		damage: raw?.damage ?? blank.damage,
		damageTags: raw?.damageTags ?? blank.damageTags,
		traits: Array.isArray(raw?.traits) ? raw.traits : blank.traits,
		instinct: raw?.instinct ?? blank.instinct,
		cost: raw?.cost ?? blank.cost,
		loyalty: raw?.loyalty ?? blank.loyalty,
		beastOfLegend: Array.isArray(raw?.beastOfLegend) ? raw.beastOfLegend : blank.beastOfLegend,
		notes: raw?.notes ?? blank.notes
	};
}

function withState(character: StonetopCharacter, next: AnimalCompanionState): StonetopCharacter {
	return {
		...character,
		inserts: {
			...character.inserts,
			[ANIMAL_COMPANION_INSERT_ID]: next as unknown as Record<string, unknown>
		}
	};
}

export function hasAnimalCompanionInsert(character: StonetopCharacter): boolean {
	return ANIMAL_COMPANION_INSERT_ID in character.inserts;
}

export function animalCompanionOf(character: StonetopCharacter): AnimalCompanionState {
	return readState(character);
}

/** Attach Animal Companion (if it isn't already), with no type chosen yet. */
export function attachAnimalCompanion(character: StonetopCharacter): StonetopCharacter {
	return attachInsert(character, ANIMAL_COMPANION_INSERT_ID, { ...blank });
}

/**
 * Pick (or change) the companion's type. Reseeds HP/armor/damage/damageTags
 * from the type's printed base and clears traits (they're specific to the
 * type's own option list) — everything else the player already wrote
 * (name, instinct, cost, loyalty, beast-of-legend picks, notes) carries over.
 */
export function setAnimalCompanionType(
	character: StonetopCharacter,
	insert: AnimalCompanionInsert,
	typeId: string
): StonetopCharacter {
	const type = insert.types.find((t) => t.id === typeId);
	if (!type) return character;
	const state = readState(character);
	return withState(character, {
		...state,
		typeId,
		hp: type.hp,
		maxHp: type.hp,
		armor: type.armor,
		damage: type.damage,
		damageTags: type.damageTags.join(', '),
		traits: []
	});
}

/** Patch simple fields — name, current HP, notes, etc. */
export function updateAnimalCompanion(
	character: StonetopCharacter,
	patch: Partial<AnimalCompanionState>
): StonetopCharacter {
	return withState(character, { ...readState(character), ...patch });
}

/** Toggle one of the chosen type's traits (or a write-in already added to the list). */
export function toggleAnimalCompanionTrait(
	character: StonetopCharacter,
	trait: string
): StonetopCharacter {
	const state = readState(character);
	const traits = state.traits.includes(trait)
		? state.traits.filter((t) => t !== trait)
		: [...state.traits, trait];
	return withState(character, { ...state, traits });
}

/** Tap-to-set the companion's Loyalty, clamped to the insert's printed max. */
export function setAnimalCompanionLoyalty(
	character: StonetopCharacter,
	loyalty: number,
	max: number
): StonetopCharacter {
	return updateAnimalCompanion(character, { loyalty: Math.min(max, Math.max(0, loyalty)) });
}

/** Log a Beast of Legend pick (the move can be taken more than once). */
export function addBeastOfLegendPick(
	character: StonetopCharacter,
	pick: string
): StonetopCharacter {
	const state = readState(character);
	return withState(character, { ...state, beastOfLegend: [...state.beastOfLegend, pick] });
}

/** Remove a logged Beast of Legend pick (a correction, not an "un-take"). */
export function removeBeastOfLegendPick(
	character: StonetopCharacter,
	index: number
): StonetopCharacter {
	const state = readState(character);
	return withState(character, {
		...state,
		beastOfLegend: state.beastOfLegend.filter((_, i) => i !== index)
	});
}
