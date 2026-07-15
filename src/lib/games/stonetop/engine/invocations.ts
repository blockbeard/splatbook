/**
 * Invocations (Stonetop, Book I p.146), the Lightbearer's class insert.
 * Auto-attaches for a Lightbearer per commit 99's `autoAttachedInsertIds` —
 * unlike Followers (commit 102) there's no player-facing "+" button; the
 * character either has this playbook or doesn't.
 *
 * The player starts knowing `startKnowing` (2) Invocations and learns one
 * more at each threshold in `learnAt` (each even level); only one *ongoing*
 * Invocation can be active at a time. State is just which ids are known and
 * which one (if any) is currently active — everything else (text, reduced/
 * empowered variants) is static pack content looked up by id.
 *
 * State lives at `character.inserts['insert-invocations']`, per the
 * attachment model (commit 99).
 */

import { attachInsert } from './character';
import type { StonetopCharacter } from './character';

export const INVOCATIONS_INSERT_ID = 'insert-invocations';

interface InvocationsState {
	known: string[];
	active: string | null;
}

function readState(character: StonetopCharacter): InvocationsState {
	const raw = character.inserts[INVOCATIONS_INSERT_ID] as Partial<InvocationsState> | undefined;
	return {
		known: Array.isArray(raw?.known) ? raw.known : [],
		active: typeof raw?.active === 'string' ? raw.active : null
	};
}

function withState(character: StonetopCharacter, next: InvocationsState): StonetopCharacter {
	return {
		...character,
		inserts: {
			...character.inserts,
			[INVOCATIONS_INSERT_ID]: next as unknown as Record<string, unknown>
		}
	};
}

export function hasInvocationsInsert(character: StonetopCharacter): boolean {
	return INVOCATIONS_INSERT_ID in character.inserts;
}

export function knownInvocations(character: StonetopCharacter): string[] {
	return readState(character).known;
}

export function activeInvocation(character: StonetopCharacter): string | null {
	return readState(character).active;
}

/** Attach Invocations (if it isn't already), knowing nothing yet. */
export function attachInvocations(character: StonetopCharacter): StonetopCharacter {
	return attachInsert(character, INVOCATIONS_INSERT_ID, { known: [], active: null });
}

/** Toggle whether an invocation is known (picking a starting or learned-at-level one). */
export function toggleKnownInvocation(
	character: StonetopCharacter,
	invocationId: string
): StonetopCharacter {
	const state = readState(character);
	const known = state.known.includes(invocationId)
		? state.known.filter((id) => id !== invocationId)
		: [...state.known, invocationId];
	// Forgetting the active invocation ends it too.
	const active = state.active !== null && !known.includes(state.active) ? null : state.active;
	return withState(character, { known, active });
}

/**
 * Toggle an invocation *ongoing*. Only one may be active at a time, so
 * activating one ends any other; activating the already-active one ends it.
 * A no-op if the invocation isn't known.
 */
export function toggleActiveInvocation(
	character: StonetopCharacter,
	invocationId: string
): StonetopCharacter {
	const state = readState(character);
	if (!state.known.includes(invocationId)) return character;
	const active = state.active === invocationId ? null : invocationId;
	return withState(character, { ...state, active });
}
