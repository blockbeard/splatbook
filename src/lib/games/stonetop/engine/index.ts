/**
 * The Stonetop engine — the game's pure rules layer, attached to the game
 * module's `engine` slot and consumed by the wizard steps and (later) play
 * mode. Pure functions over plain data; no UI/DB/SvelteKit imports.
 *
 * The shell treats this as opaque (`GameModule.engine` is `unknown`): only
 * Stonetop's own step/sheet code reaches in with types. See
 * `docs/architecture.md`.
 */

export {
	SCHEMA_VERSION,
	STAT_KEYS,
	createCharacter,
	setTrackerMarks,
	statValue,
	type StatKey,
	type StatValue,
	type TrackerState,
	type ChoiceSelection,
	type ExtrasSectionState,
	type StonetopCharacter
} from './character';

export {
	validateCharacter,
	isComplete,
	validators,
	possessionChoiceKey,
	isWriteInPossession,
	type Issue,
	type Severity,
	type StepId,
	type Validator
} from './validation';

export {
	selectionCount,
	isSelectionValid,
	canPickMore,
	toggleOption,
	type ChoiceLike
} from './choices';

export {
	assignStat,
	clearStat,
	assignedValues,
	remainingValues,
	isStatArrayComplete
} from './stats';

export {
	startingMovesPlan,
	pickOneMembers,
	pickOneSelections,
	freeChosenMoves,
	fullMoveSet,
	isStartable,
	prerequisitesMet,
	choosableMoves,
	type StartingMovesPlan
} from './moves';

import { createCharacter } from './character';
import { validateCharacter, isComplete } from './validation';

/** Convenience bundle attached to `stonetop.engine`. */
export const engine = {
	createCharacter,
	validateCharacter,
	isComplete
} as const;

export type StonetopEngine = typeof engine;
