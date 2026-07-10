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
	migrateCharacter,
	setTrackerMarks,
	statValue,
	type StatKey,
	type StatValue,
	type TrackerState,
	type ChoiceSelection,
	type ExtrasSectionState,
	type AdvancementEntry,
	type InventoryState,
	type StonetopCharacter
} from './character';

export {
	gearSlots,
	gearLoad,
	parseMarks,
	loadBand,
	carryingGear,
	toggleGear,
	carryingSmall,
	toggleSmallItem,
	setUndefinedGear,
	setUndefinedSmall,
	assignUndefinedGear,
	assignUndefinedSmall,
	carriedGear
} from './inventory';

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

export {
	heldMoveIds,
	xpForNextLevel,
	canLevelUp,
	markXp,
	seedVitals,
	syncMoveTrackers,
	enterPlay,
	setHp,
	applyDamage,
	healHp,
	isDebilitated,
	setDebility,
	effectiveStat,
	effectiveStats,
	debilityName,
	statAtCap,
	bumpStat
} from './play';

export {
	timesTaken,
	maxTakes,
	isMaxedOut,
	meetsLevel,
	trackerGateMet,
	legalChoices,
	levelUpChoices,
	applyLevelUp,
	advancementLog,
	asteriskMoves,
	holdsAsteriskMove,
	isWouldBeCrossed,
	canCrossOffWouldBe,
	crossOffWouldBe,
	HERO_FLAG,
	type LevelUpChoice,
	type LevelUpError,
	type LevelUpResult,
	type AdvancementLogEntry
} from './advancement';

import { createCharacter } from './character';
import { validateCharacter, isComplete } from './validation';

/** Convenience bundle attached to `stonetop.engine`. */
export const engine = {
	createCharacter,
	validateCharacter,
	isComplete
} as const;

export type StonetopEngine = typeof engine;
