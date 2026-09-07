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
	addSeat,
	buildDecks,
	createTable,
	migrateTable,
	removeOpponent,
	removeSeat,
	setGmSeat,
	splitOpponent,
	updateOpponent,
	withFoolCards,
	type CardTable,
	type DeckDefinition,
	type Opponent
} from './table';
export { setMode, type TableMode } from './mode';
export {
	advanceCount,
	beginRound,
	endRound,
	mulliganGmHand,
	newRound,
	rewindCount,
	rngFromSeed,
	setCount,
	setMinorActions,
	suggestGmHandSize,
	type BeginRoundOptions,
	type GmHandConfig,
	type Round
} from './round';
export {
	beginInterrupt,
	clearExtraTurn,
	clearFacedown,
	endInterrupt,
	facedownZoneOf,
	placeFacedown,
	playFool,
	revealFacedown,
	skipTurn,
	type ExceptionResult,
	type FacedownAction,
	type FacedownPosition
} from './exceptions';
export { hiddenFrom, projectFor, type ProjectedTable, type ProjectedZone } from './projection';
export {
	canSeeFaces,
	deal,
	emptyInto,
	moveCard,
	reshuffleDeck,
	type DealResult,
	type MoveFailure,
	type MoveResult,
	type Pick
} from './moves';
