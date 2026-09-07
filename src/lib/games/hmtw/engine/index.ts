/**
 * The HMtW card-table engine — pure TypeScript, no UI, DB, or `Math.random`.
 *
 * Opaque to the shell, which persists what it returns and calls `migrateTable`
 * on every read. See `moves.ts` for the one rule that governs the whole thing:
 * it refuses the impossible and the unsafe, never the merely illegal.
 */

export { seededRng, shuffle, type Rng } from './shuffle';
export {
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
	type CardTable,
	type DeckDefinition,
	type Opponent
} from './table';
export {
	deal,
	emptyInto,
	moveCard,
	reshuffleDeck,
	type DealResult,
	type MoveFailure,
	type MoveResult,
	type Pick
} from './moves';
