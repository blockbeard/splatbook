/**
 * Crew (Stonetop, Book I p.144) — the Marshal's class insert, a single
 * group-follower rather than a roster (contrast Followers, commit 102).
 * `insert-crew.json` prints fixed base stats (HP/armor/damage), a mix of
 * fixed and chosen tags, an instinct/cost pick with a Loyalty track, a fixed
 * equipment list with a few write-in gear lines, and an "individuals" list
 * for crew members who stand out (named, tagged, given traits) — capped at
 * `individuals.portraitBoxes`.
 *
 * State lives at `character.inserts['insert-crew']`. Tags/instinct/cost/gear
 * are all pick-driven in the pack, but stored here as plain selections and
 * write-in strings — the component reads the pack's option lists to render
 * the pickers.
 */

import type { CrewInsert } from '../pack-schemas';
import { attachInsert } from './character';
import type { StonetopCharacter } from './character';

export const CREW_INSERT_ID = 'insert-crew';

export interface CrewIndividual {
	name: string;
	tag: string;
	traits: string;
}

export interface CrewState {
	tags: string[];
	tagsWriteIn: string[];
	specialTags: string[];
	instinct: string;
	cost: string;
	loyalty: number;
	gear: string[];
	individuals: CrewIndividual[];
	notes: string;
}

function readState(character: StonetopCharacter): CrewState {
	const raw = character.inserts[CREW_INSERT_ID] as Partial<CrewState> | undefined;
	return {
		tags: Array.isArray(raw?.tags) ? raw.tags : [],
		tagsWriteIn: Array.isArray(raw?.tagsWriteIn) ? raw.tagsWriteIn : [],
		specialTags: Array.isArray(raw?.specialTags) ? raw.specialTags : [],
		instinct: raw?.instinct ?? '',
		cost: raw?.cost ?? '',
		loyalty: raw?.loyalty ?? 0,
		gear: Array.isArray(raw?.gear) ? raw.gear : [],
		individuals: Array.isArray(raw?.individuals) ? raw.individuals : [],
		notes: raw?.notes ?? ''
	};
}

function withState(character: StonetopCharacter, next: CrewState): StonetopCharacter {
	return {
		...character,
		inserts: { ...character.inserts, [CREW_INSERT_ID]: next as unknown as Record<string, unknown> }
	};
}

export function hasCrewInsert(character: StonetopCharacter): boolean {
	return CREW_INSERT_ID in character.inserts;
}

export function crewOf(character: StonetopCharacter): CrewState {
	return readState(character);
}

/** Attach Crew (if it isn't already), blank write-ins shaped by the insert. */
export function attachCrew(character: StonetopCharacter, insert: CrewInsert): StonetopCharacter {
	return attachInsert(character, CREW_INSERT_ID, {
		tags: [],
		tagsWriteIn: Array(insert.tags.writeIn).fill(''),
		specialTags: [],
		instinct: '',
		cost: '',
		loyalty: 0,
		gear: insert.inventory.writeIns.lines.map(() => ''),
		individuals: [],
		notes: ''
	});
}

/** Patch simple fields — instinct, cost, notes. */
export function updateCrew(
	character: StonetopCharacter,
	patch: Partial<CrewState>
): StonetopCharacter {
	return withState(character, { ...readState(character), ...patch });
}

/** Toggle one of the printed tag options. */
export function toggleCrewTag(character: StonetopCharacter, tag: string): StonetopCharacter {
	const state = readState(character);
	const tags = state.tags.includes(tag)
		? state.tags.filter((t) => t !== tag)
		: [...state.tags, tag];
	return withState(character, { ...state, tags });
}

/** Toggle a special tag (e.g. *exceptional*, gated behind a move). */
export function toggleCrewSpecialTag(character: StonetopCharacter, tag: string): StonetopCharacter {
	const state = readState(character);
	const specialTags = state.specialTags.includes(tag)
		? state.specialTags.filter((t) => t !== tag)
		: [...state.specialTags, tag];
	return withState(character, { ...state, specialTags });
}

/** Write into one of the free tag-write-in slots. */
export function setCrewTagWriteIn(
	character: StonetopCharacter,
	index: number,
	value: string
): StonetopCharacter {
	const state = readState(character);
	if (index < 0 || index >= state.tagsWriteIn.length) return character;
	return withState(character, {
		...state,
		tagsWriteIn: state.tagsWriteIn.map((t, i) => (i === index ? value : t))
	});
}

/** Write into one of the free gear-write-in lines. */
export function setCrewGearLine(
	character: StonetopCharacter,
	index: number,
	value: string
): StonetopCharacter {
	const state = readState(character);
	if (index < 0 || index >= state.gear.length) return character;
	return withState(character, {
		...state,
		gear: state.gear.map((g, i) => (i === index ? value : g))
	});
}

/** Tap-to-set Crew's Loyalty, clamped to the insert's printed max. */
export function setCrewLoyalty(
	character: StonetopCharacter,
	loyalty: number,
	max: number
): StonetopCharacter {
	return updateCrew(character, { loyalty: Math.min(max, Math.max(0, loyalty)) });
}

/** Add a standout crew member, capped at the insert's `portraitBoxes`. */
export function addCrewIndividual(
	character: StonetopCharacter,
	insert: CrewInsert
): StonetopCharacter {
	const state = readState(character);
	if (state.individuals.length >= insert.individuals.portraitBoxes) return character;
	return withState(character, {
		...state,
		individuals: [...state.individuals, { name: '', tag: '', traits: '' }]
	});
}

export function removeCrewIndividual(
	character: StonetopCharacter,
	index: number
): StonetopCharacter {
	const state = readState(character);
	return withState(character, {
		...state,
		individuals: state.individuals.filter((_, i) => i !== index)
	});
}

export function updateCrewIndividual(
	character: StonetopCharacter,
	index: number,
	patch: Partial<CrewIndividual>
): StonetopCharacter {
	const state = readState(character);
	if (index < 0 || index >= state.individuals.length) return character;
	return withState(character, {
		...state,
		individuals: state.individuals.map((ind, i) => (i === index ? { ...ind, ...patch } : ind))
	});
}
