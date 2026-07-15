/**
 * Ghost and Revenant (Stonetop, Book I p.148-151) — the two undead inserts,
 * gained narratively (dying in a particular way) rather than attached by
 * playbook or move, so there's no `autoAttachedInsertIds` rule for either;
 * a player or GM attaches one when the fiction calls for it. Structurally
 * identical (both replace the playbook Instinct, grant a fixed move set,
 * pick a Terrible Purpose, and track Consequences toward a shared Final
 * Consequence — same shape `undeadInsertSchema` already validates both
 * against), so one engine module serves both, parametrized by insert id.
 *
 * Consequences can gate on an earlier pick (Ghost's `unstable` requires
 * `breakdown` already marked) — `toggleUndeadConsequence` takes the pack
 * insert to check that, and unmarking a prerequisite cascades to unmark
 * anything that required it, so the state can't end up pointing at a gate
 * that no longer holds.
 *
 * State lives at `character.inserts['insert-ghost']` / `['insert-revenant']`.
 */

import type { GhostInsert } from '../pack-schemas';
import { attachInsert } from './character';
import type { StonetopCharacter } from './character';

export const GHOST_INSERT_ID = 'insert-ghost';
export const REVENANT_INSERT_ID = 'insert-revenant';

export interface UndeadState {
	instinctId: string | null;
	terriblePurposeId: string | null;
	consequences: string[];
	finalMarked: boolean;
}

const blank: UndeadState = {
	instinctId: null,
	terriblePurposeId: null,
	consequences: [],
	finalMarked: false
};

function readState(character: StonetopCharacter, insertId: string): UndeadState {
	const raw = character.inserts[insertId] as Partial<UndeadState> | undefined;
	return {
		instinctId: raw?.instinctId ?? blank.instinctId,
		terriblePurposeId: raw?.terriblePurposeId ?? blank.terriblePurposeId,
		consequences: Array.isArray(raw?.consequences) ? raw.consequences : blank.consequences,
		finalMarked: raw?.finalMarked ?? blank.finalMarked
	};
}

function withState(
	character: StonetopCharacter,
	insertId: string,
	next: UndeadState
): StonetopCharacter {
	return {
		...character,
		inserts: { ...character.inserts, [insertId]: next as unknown as Record<string, unknown> }
	};
}

export function hasUndeadInsert(character: StonetopCharacter, insertId: string): boolean {
	return insertId in character.inserts;
}

export function undeadStateOf(character: StonetopCharacter, insertId: string): UndeadState {
	return readState(character, insertId);
}

/** Attach Ghost or Revenant (if it isn't already), with nothing chosen yet. */
export function attachUndeadInsert(
	character: StonetopCharacter,
	insertId: string
): StonetopCharacter {
	return attachInsert(character, insertId, { ...blank });
}

/** Replace the playbook Instinct with one of the insert's own. */
export function setUndeadInstinct(
	character: StonetopCharacter,
	insertId: string,
	instinctId: string
): StonetopCharacter {
	return withState(character, insertId, { ...readState(character, insertId), instinctId });
}

/** Pick the Terrible Purpose. */
export function setTerriblePurpose(
	character: StonetopCharacter,
	insertId: string,
	purposeId: string
): StonetopCharacter {
	return withState(character, insertId, {
		...readState(character, insertId),
		terriblePurposeId: purposeId
	});
}

/**
 * Toggle a Consequence. Marking one that requires an earlier pick is a no-op
 * until that pick is marked; unmarking a pick that gates others cascades to
 * unmark those too.
 */
export function toggleUndeadConsequence(
	character: StonetopCharacter,
	insertId: string,
	insert: GhostInsert,
	consequenceId: string
): StonetopCharacter {
	const state = readState(character, insertId);
	const marked = state.consequences.includes(consequenceId);

	if (!marked) {
		const entry = insert.consequences.list.find((c) => c.id === consequenceId);
		const requires = entry?.requires?.consequences ?? [];
		if (!requires.every((id) => state.consequences.includes(id))) return character;
		return withState(character, insertId, {
			...state,
			consequences: [...state.consequences, consequenceId]
		});
	}

	// Unmarking: cascade to anything that required this one.
	const toRemove = new Set([consequenceId]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const entry of insert.consequences.list) {
			if (toRemove.has(entry.id)) continue;
			const requires = entry.requires?.consequences ?? [];
			if (requires.some((id) => toRemove.has(id)) && state.consequences.includes(entry.id)) {
				toRemove.add(entry.id);
				changed = true;
			}
		}
	}
	return withState(character, insertId, {
		...state,
		consequences: state.consequences.filter((id) => !toRemove.has(id))
	});
}

/** Toggle the Final Consequence — the end of this character's story. */
export function toggleFinalConsequence(
	character: StonetopCharacter,
	insertId: string
): StonetopCharacter {
	const state = readState(character, insertId);
	return withState(character, insertId, { ...state, finalMarked: !state.finalMarked });
}

// Ergonomic per-insert aliases, matching the naming convention every other
// insert module uses (hasFollowersInsert, crewOf, etc.) rather than making
// every call site pass the insert id by hand.

export const hasGhostInsert = (character: StonetopCharacter): boolean =>
	hasUndeadInsert(character, GHOST_INSERT_ID);
export const ghostStateOf = (character: StonetopCharacter): UndeadState =>
	undeadStateOf(character, GHOST_INSERT_ID);
export const attachGhost = (character: StonetopCharacter): StonetopCharacter =>
	attachUndeadInsert(character, GHOST_INSERT_ID);

export const hasRevenantInsert = (character: StonetopCharacter): boolean =>
	hasUndeadInsert(character, REVENANT_INSERT_ID);
export const revenantStateOf = (character: StonetopCharacter): UndeadState =>
	undeadStateOf(character, REVENANT_INSERT_ID);
export const attachRevenant = (character: StonetopCharacter): StonetopCharacter =>
	attachUndeadInsert(character, REVENANT_INSERT_ID);
