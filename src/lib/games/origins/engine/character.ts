/**
 * The Origins 5.5e character: shape, seed, and migration.
 *
 * Pure TypeScript — no UI, DB, or SvelteKit imports. The shell persists this
 * blob opaquely; only Origins' own code reads inside it.
 *
 * **Store choices, derive everything else.** A character records what its
 * player picked — a background id, a species id, six base scores, which
 * equipment option — and never the numbers that fall out of those picks. AC,
 * hit points, saves, skill modifiers and the purse are all computed from the
 * pack at render time (`derived.ts`), so fixing a rule fixes every character
 * ever saved instead of leaving a migration to write.
 *
 * The two exceptions are deliberate, and both are *rolls*: the hit die roll and
 * the ability rolls are events, not derivations. Re-deriving them would reroll
 * the character every time the sheet opened.
 */

import type { Ability } from '../pack-schemas';

/** Bump whenever this shape changes, and extend `migrateCharacter` in the same commit. */
export const SCHEMA_VERSION = 1;

export const ABILITIES: readonly Ability[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** How the six base scores were arrived at. */
export type AbilityMethod = 'standard-array' | 'point-buy' | 'roll';

/** A per-ability record, e.g. the six base scores. */
export type AbilityMap<T> = Record<Ability, T>;

export interface OriginsAbilities {
	method: AbilityMethod | null;
	/** The six scores before the background's increases. Null until assigned. */
	base: AbilityMap<number | null>;
	/**
	 * The background's ability increases: one +2 and one +1, or +1 to all three.
	 * Keyed by ability; absent abilities are +0.
	 */
	increases: Partial<AbilityMap<number>>;
	/** The six numbers rolled, when `method` is `roll` — kept so the sheet can
	 * show the pool the player assigned from, and so reopening never rerolls. */
	rolled: number[];
}

/** A line in the character's inventory. Free text: the SRD writes equipment as
 * prose ("4 Handaxes"), and inventing item ids for it would be guessing. */
export interface InventoryItem {
	name: string;
	quantity: number;
}

export interface OriginsEquipment {
	/** Which of the background's starting-equipment options was taken (`a`/`b`). */
	optionId: string | null;
	/** The ordinary equipment kit Origins adds to Option A, by pack id. */
	packId: string | null;
	items: InventoryItem[];
	/** The purse, in copper. */
	goldCp: number;
	/** Worn armor, by pack id. Null means unarmored. */
	armorId: string | null;
	shield: boolean;
}

export interface OriginsSpells {
	/** Chosen from the list the background's Magic Initiate feat opened. */
	cantrips: string[];
	level1: string[];
	/** Intelligence, Wisdom or Charisma — chosen when the feat is taken. */
	ability: Ability | null;
	/**
	 * Which level 1 spells have been cast since the last Long Rest. Origins has
	 * no slots: each spell you know is one casting per Long Rest, and cantrips
	 * and rituals never land here.
	 */
	spent: string[];
}

export interface OriginsDetails {
	alignment: string;
	appearance: string;
	personality: string;
	history: string;
	/** The player's own notes — anything the sheet has no field for. */
	notes: string;
}

export interface OriginsCharacter {
	schemaVersion: number;
	name: string;

	// --- Origin: the three picks that make the character ---
	backgroundId: string | null;
	/**
	 * The class borrowed for its Hit Point Die, Armor Training, Shields and
	 * Weapon Proficiencies — and nothing else. Not a class: the character has
	 * none.
	 */
	referenceClassId: string | null;
	speciesId: string | null;
	/** Species choice id → chosen option id (`elven-lineage` → `wood-elf`). */
	speciesChoices: Record<string, string>;

	abilities: OriginsAbilities;

	// --- Proficiencies. Skills and tools are ids/names from the pack; each has
	// a source so the sheet can say where it came from and the builder can tell
	// a granted proficiency from a chosen one.
	skills: string[];
	tools: string[];
	languages: string[];

	equipment: OriginsEquipment;
	spells: OriginsSpells;

	/**
	 * The hit die roll. Origins rolls it rather than taking the maximum, so it
	 * is recorded once and never re-derived. `current` tracks damage in play.
	 */
	hitPoints: { rolled: number | null; current: number | null; temporary: number };

	details: OriginsDetails;
}

const emptyAbilityMap = (): AbilityMap<number | null> => ({
	STR: null,
	DEX: null,
	CON: null,
	INT: null,
	WIS: null,
	CHA: null
});

/** A blank character. Every choice open; nothing assumed. */
export function createCharacter(): OriginsCharacter {
	return {
		schemaVersion: SCHEMA_VERSION,
		name: '',
		backgroundId: null,
		referenceClassId: null,
		speciesId: null,
		speciesChoices: {},
		abilities: { method: null, base: emptyAbilityMap(), increases: {}, rolled: [] },
		skills: [],
		tools: [],
		languages: [],
		equipment: {
			optionId: null,
			packId: null,
			items: [],
			goldCp: 0,
			armorId: null,
			shield: false
		},
		spells: { cantrips: [], level1: [], ability: null, spent: [] },
		hitPoints: { rolled: null, current: null, temporary: 0 },
		details: { alignment: '', appearance: '', personality: '', history: '', notes: '' }
	};
}

/**
 * Bring a saved blob up to `SCHEMA_VERSION`.
 *
 * Called wherever a character is read. Only v1 exists so far, so this fills in
 * anything a partial blob is missing rather than transforming between versions
 * — which is also what makes it safe against a hand-edited or truncated save.
 */
export function migrateCharacter(raw: unknown): OriginsCharacter {
	const blank = createCharacter();
	if (!raw || typeof raw !== 'object') return blank;
	const c = raw as Partial<OriginsCharacter>;

	return {
		...blank,
		...c,
		schemaVersion: SCHEMA_VERSION,
		speciesChoices: { ...c.speciesChoices },
		abilities: {
			...blank.abilities,
			...c.abilities,
			base: { ...blank.abilities.base, ...c.abilities?.base },
			increases: { ...c.abilities?.increases },
			rolled: [...(c.abilities?.rolled ?? [])]
		},
		skills: [...(c.skills ?? [])],
		tools: [...(c.tools ?? [])],
		languages: [...(c.languages ?? [])],
		equipment: {
			...blank.equipment,
			...c.equipment,
			items: (c.equipment?.items ?? []).map((i) => ({ ...i }))
		},
		spells: { ...blank.spells, ...c.spells, spent: [...(c.spells?.spent ?? [])] },
		hitPoints: { ...blank.hitPoints, ...c.hitPoints },
		details: { ...blank.details, ...c.details }
	};
}
