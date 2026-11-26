/**
 * The HMtW card-table engine — pure TypeScript, no UI, DB, or `Math.random`.
 *
 * Opaque to the shell, which persists what it returns and calls `migrateTable`
 * on every read. See `moves.ts` for the one rule that governs the whole thing:
 * it refuses the impossible and the unsafe, never the merely illegal.
 */

export { seededRng, shuffle, type Rng } from './shuffle';
export {
	FATE_ZONE,
	deckZone,
	discardZone,
	opponentZone,
	opponentZones,
	seatZone,
	seatZones,
	tableZones,
	type DeckId,
	type OpponentZoneKind,
	type SeatZoneKind,
	type Zone,
	type ZoneVisibility
} from './zones';
export {
	TABLE_SCHEMA_VERSION,
	addOpponent,
	nextLetterIndex,
	upCount,
	addSeat,
	buildDecks,
	createTable,
	migrateTable,
	removeOpponent,
	removeSeat,
	setGmSeat,
	updateOpponent,
	withDeckFacts,
	type CardTable,
	type DeckDefinition,
	type Opponent,
	type Play
} from './table';
export { setMode, type TableMode } from './mode';
export {
	beginRound,
	endRound,
	mulliganGmHand,
	newRound,
	rngFromSeed,
	suggestGmHandSize,
	type BeginRoundOptions,
	type GmHandConfig,
	type Round,
	type RoundStep
} from './round';
export {
	declareMinor,
	dropReadied,
	discardFor,
	expectedInitiative,
	expectedMinor,
	nextNumber,
	passMinor,
	playInitiative,
	playOutOfTurn,
	playTurn,
	readyMinor,
	resolveNumber,
	revealMinors,
	showInitiative,
	skipTurn,
	startCount,
	stepOn,
	takeBack,
	upAt,
	useReadied,
	waitingForInitiative,
	waitingForMinor,
	type StepFailure,
	type StepResult,
	type TurnPlay
} from './steps';
export {
	clearFacedown,
	facedownZoneOf,
	placeFacedown,
	revealFacedown,
	type ExceptionResult,
	type FacedownAction,
	type FacedownPosition
} from './exceptions';
export { counselFor, giveCard, liveCounsel, type Counsel, type GiveFailure } from './counsel';
export { hiddenFrom, projectFor, type ProjectedTable, type ProjectedZone } from './projection';
export {
	canSeeFaces,
	deal,
	emptyInto,
	discardAll,
	moveCard,
	reshuffleDeck,
	type DealResult,
	type MoveFailure,
	type MoveResult,
	type Pick
} from './moves';
export {
	MAX_SCENE_ZONES,
	MAX_SCENE_ZONE_NAME,
	clearScene,
	emptyScene,
	forgetPlacements,
	placeInScene,
	placeable,
	setScenePicture,
	setSceneZones,
	type Scene,
	type ScenePicture,
	type SceneZone
} from './scene';
export {
	MAX_CREATURES,
	MAX_HD,
	clampHd,
	creatureId,
	creatureLabel,
	freshPools,
	letterFor,
	letterIndex,
	makeCreatures,
	type Creature,
	type HdPool
} from './creatures';
export {
	addCreatures,
	findCreature,
	rejoinSplitGroups,
	removeCreature,
	setDown,
	setHd,
	type HdResult,
	type HdStat
} from './groups';
