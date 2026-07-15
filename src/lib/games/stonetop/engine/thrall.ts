/**
 * Thrall (Stonetop, Book I p.152-153) — the third narratively-gained undead
 * insert: dying and calling on a Thing Below instead of passing through the
 * Last Door. Unlike Ghost/Revenant, Thrall's granted moves include one with
 * its own tracker (Favor, 0-3) — but since these are insert-granted moves,
 * not part of the playbook's own move list, they never enter `character.moves`
 * and so never reach `syncMoveTrackers`. Favor is tracked directly on this
 * insert's own state instead.
 *
 * State lives at `character.inserts['insert-thrall']`.
 */

import { attachInsert } from './character';
import type { StonetopCharacter } from './character';

export const THRALL_INSERT_ID = 'insert-thrall';

export interface ThrallState {
	masterName: string;
	impulse: string;
	instinctId: string | null;
	favor: number;
	marks: string[];
}

const blank: ThrallState = {
	masterName: '',
	impulse: '',
	instinctId: null,
	favor: 0,
	marks: []
};

function readState(character: StonetopCharacter): ThrallState {
	const raw = character.inserts[THRALL_INSERT_ID] as Partial<ThrallState> | undefined;
	return {
		masterName: raw?.masterName ?? blank.masterName,
		impulse: raw?.impulse ?? blank.impulse,
		instinctId: raw?.instinctId ?? blank.instinctId,
		favor: raw?.favor ?? blank.favor,
		marks: Array.isArray(raw?.marks) ? raw.marks : blank.marks
	};
}

function withState(character: StonetopCharacter, next: ThrallState): StonetopCharacter {
	return {
		...character,
		inserts: {
			...character.inserts,
			[THRALL_INSERT_ID]: next as unknown as Record<string, unknown>
		}
	};
}

export function hasThrallInsert(character: StonetopCharacter): boolean {
	return THRALL_INSERT_ID in character.inserts;
}

export function thrallStateOf(character: StonetopCharacter): ThrallState {
	return readState(character);
}

/** Attach Thrall (if it isn't already), with nothing chosen yet. */
export function attachThrall(character: StonetopCharacter): StonetopCharacter {
	return attachInsert(character, THRALL_INSERT_ID, { ...blank });
}

/** Patch simple fields — master's name, impulse, instinct. */
export function updateThrall(
	character: StonetopCharacter,
	patch: Partial<ThrallState>
): StonetopCharacter {
	return withState(character, { ...readState(character), ...patch });
}

/** Set Favor, clamped to [0, 3] per the printed tracker. */
export function setThrallFavor(character: StonetopCharacter, favor: number): StonetopCharacter {
	return updateThrall(character, { favor: Math.min(3, Math.max(0, favor)) });
}

/** Toggle one of the printed Marks. */
export function toggleThrallMark(character: StonetopCharacter, markId: string): StonetopCharacter {
	const state = readState(character);
	const marks = state.marks.includes(markId)
		? state.marks.filter((m) => m !== markId)
		: [...state.marks, markId];
	return withState(character, { ...state, marks });
}
