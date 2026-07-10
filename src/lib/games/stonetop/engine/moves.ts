/**
 * Starting-moves rules — the rules-lawyer core of character creation.
 *
 * At level 1 a character's moves come from three places: the playbook's fixed
 * moves (always granted), its chosen background (grants), and the player's own
 * picks — one from each `pickOne` group plus `choose` free moves from the list.
 * Free picks must be *startable* (not gated behind a level ≥ 2 requirement) and
 * have their prerequisites met (`requires.moves`, `childOf`).
 *
 * Pure and unit-tested; `MovesStep.svelte` renders against these helpers and
 * `validateMoves` (in `validation.ts`) reuses them.
 */

import type { Move, Playbook } from '../pack-schemas';
import type { StonetopCharacter } from './character';

/** Creation level — moves requiring level ≥ 2 are advancement moves, not startable. */
const START_LEVEL = 1;

/** Where a character's starting moves come from, resolved against a playbook. */
export interface StartingMovesPlan {
	/** Playbook fixed moves — always granted. */
	fixed: string[];
	/** Moves granted by the chosen background. */
	background: string[];
	/** Groups from which the player picks exactly one each. */
	pickOneGroups: string[][];
	/** How many free moves to choose from the list. */
	chooseCount: number;
	/** Always-on moves (fixed + background), the baseline for prerequisite checks. */
	granted: string[];
}

/** Resolve the starting-moves plan for a character's playbook + chosen background. */
export function startingMovesPlan(
	character: StonetopCharacter,
	playbook: Playbook
): StartingMovesPlan {
	const starting = playbook.moves.starting;
	const fixed = starting.fixed ?? [];
	const background =
		(character.backgroundId
			? playbook.backgrounds.find((b) => b.id === character.backgroundId)?.grants?.moves
			: undefined) ?? [];
	return {
		fixed,
		background,
		pickOneGroups: starting.pickOne ?? [],
		chooseCount: starting.choose ?? 0,
		granted: [...new Set([...fixed, ...background])]
	};
}

/** Ids appearing in any pickOne group. */
export function pickOneMembers(plan: StartingMovesPlan): Set<string> {
	return new Set(plan.pickOneGroups.flat());
}

/** For each pickOne group, the id the player selected from it (or undefined). */
export function pickOneSelections(
	character: StonetopCharacter,
	plan: StartingMovesPlan
): (string | undefined)[] {
	const chosen = new Set(character.moves);
	return plan.pickOneGroups.map((group) => group.find((id) => chosen.has(id)));
}

/** The player's free-choice moves: chosen, minus granted and minus pickOne members. */
export function freeChosenMoves(character: StonetopCharacter, plan: StartingMovesPlan): string[] {
	const granted = new Set(plan.granted);
	const pickOne = pickOneMembers(plan);
	return character.moves.filter((id) => !granted.has(id) && !pickOne.has(id));
}

/** The full move set a character has so far (granted ∪ chosen). */
export function fullMoveSet(character: StonetopCharacter, plan: StartingMovesPlan): Set<string> {
	return new Set([...plan.granted, ...character.moves]);
}

/** A move is startable at creation if it isn't gated behind a level ≥ 2 requirement. */
export function isStartable(move: Move): boolean {
	const level = move.requires?.level;
	return level === undefined || level <= START_LEVEL;
}

/** Whether a move's prerequisites (required moves, parent) are satisfied by `have`. */
export function prerequisitesMet(move: Move, have: ReadonlySet<string>): boolean {
	if (move.childOf && !have.has(move.childOf)) return false;
	return (move.requires?.moves ?? []).every((id) => have.has(id));
}

/**
 * Moves eligible for a free "choose" pick: in the list, not already granted,
 * not part of a pickOne group, and startable. Prerequisite gating is applied
 * per-render by the UI (a move becomes pickable once its parent is taken).
 */
export function choosableMoves(character: StonetopCharacter, playbook: Playbook): Move[] {
	const plan = startingMovesPlan(character, playbook);
	const granted = new Set(plan.granted);
	const pickOne = pickOneMembers(plan);
	return playbook.moves.list.filter(
		(m) => !granted.has(m.id) && !pickOne.has(m.id) && isStartable(m)
	);
}
