/**
 * Initiates of Danu (Stonetop, Book I p.145) — the Blessed's class insert,
 * gated behind the Initiate background (commit 99's `autoAttachedInsertIds`
 * checks `backgroundId === 'initiate'`).
 *
 * Unlike Followers' blank write-in roster, this insert's roster is a fixed
 * catalogue of named NPCs (`insert.initiates`) the player picks `pick.min`
 * to `pick.max` of at creation. So state is keyed by the catalogue id rather
 * than an array index: presence of an id in `picks` means that initiate was
 * chosen, and each pick tracks only what changes in play (current HP,
 * Loyalty, and the flavor `choices` — pronouns, manner, etc. — the catalogue
 * entry prompts for). Name/tags/damage/moves/cost stay in the pack; the
 * component looks them up by id alongside the state.
 *
 * State lives at `character.inserts['insert-initiates-of-danu']`.
 */

import type { InitiatesOfDanuInsert } from '../pack-schemas';
import { attachInsert } from './character';
import type { StonetopCharacter } from './character';

export const INITIATES_OF_DANU_INSERT_ID = 'insert-initiates-of-danu';

export type InitiateEntry = InitiatesOfDanuInsert['initiates'][number];

export interface InitiatePick {
	hp: number;
	loyalty: number;
	choices: Record<string, string>;
}

interface InitiatesState {
	picks: Record<string, InitiatePick>;
}

function readState(character: StonetopCharacter): InitiatesState {
	const raw = character.inserts[INITIATES_OF_DANU_INSERT_ID] as Partial<InitiatesState> | undefined;
	return { picks: raw?.picks && typeof raw.picks === 'object' ? raw.picks : {} };
}

function withState(character: StonetopCharacter, next: InitiatesState): StonetopCharacter {
	return {
		...character,
		inserts: {
			...character.inserts,
			[INITIATES_OF_DANU_INSERT_ID]: next as unknown as Record<string, unknown>
		}
	};
}

export function hasInitiatesOfDanuInsert(character: StonetopCharacter): boolean {
	return INITIATES_OF_DANU_INSERT_ID in character.inserts;
}

/** The picked initiates, keyed by catalogue id. */
export function initiatePicksOf(character: StonetopCharacter): Record<string, InitiatePick> {
	return readState(character).picks;
}

/** Attach Initiates of Danu (if it isn't already), with nobody picked yet. */
export function attachInitiatesOfDanu(character: StonetopCharacter): StonetopCharacter {
	return attachInsert(character, INITIATES_OF_DANU_INSERT_ID, { picks: {} });
}

/** Mark a catalogue initiate as picked, seeding HP from its printed stat. */
export function pickInitiate(
	character: StonetopCharacter,
	initiate: InitiateEntry
): StonetopCharacter {
	const state = readState(character);
	if (initiate.id in state.picks) return character;
	return withState(character, {
		picks: { ...state.picks, [initiate.id]: { hp: initiate.hp, loyalty: 0, choices: {} } }
	});
}

/** Cross an initiate back off — they were never chosen after all. */
export function unpickInitiate(
	character: StonetopCharacter,
	initiateId: string
): StonetopCharacter {
	const state = readState(character);
	if (!(initiateId in state.picks)) return character;
	const picks = { ...state.picks };
	delete picks[initiateId];
	return withState(character, { picks });
}

function updatePick(
	character: StonetopCharacter,
	initiateId: string,
	patch: Partial<InitiatePick>
): StonetopCharacter {
	const state = readState(character);
	const pick = state.picks[initiateId];
	if (!pick) return character;
	return withState(character, {
		picks: { ...state.picks, [initiateId]: { ...pick, ...patch } }
	});
}

export function setInitiateHp(
	character: StonetopCharacter,
	initiateId: string,
	hp: number
): StonetopCharacter {
	return updatePick(character, initiateId, { hp });
}

/** Tap-to-set an initiate's Loyalty, clamped to the insert's printed max. */
export function setInitiateLoyalty(
	character: StonetopCharacter,
	initiateId: string,
	loyalty: number,
	max: number
): StonetopCharacter {
	return updatePick(character, initiateId, { loyalty: Math.min(max, Math.max(0, loyalty)) });
}

/** Answer one of the catalogue entry's flavor prompts (pronouns, manner, etc.). */
export function setInitiateChoice(
	character: StonetopCharacter,
	initiateId: string,
	prompt: string,
	value: string
): StonetopCharacter {
	const state = readState(character);
	const pick = state.picks[initiateId];
	if (!pick) return character;
	return updatePick(character, initiateId, { choices: { ...pick.choices, [prompt]: value } });
}
