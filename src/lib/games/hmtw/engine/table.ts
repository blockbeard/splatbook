/**
 * The card table's state: what is saved, how it is created, and how it migrates.
 *
 * Pure — no UI, no DB, no `Math.random`. The shell persists whatever this
 * returns as an opaque blob and calls `migrateTable` on every read, exactly as
 * it calls a game's `migrate*` for an entity. A table is long-lived (six weeks),
 * so the migration is not paperwork: a shape change shipped mid-phase would
 * otherwise break a table that people are sitting at mid-round.
 */

import { seatZones, tableZones, type Zone } from './zones';

/**
 * Bump on any change to the saved shape, in the same commit as the change, and
 * extend `migrateTable` with a test that loads a fixture of the old shape.
 *
 * v1 (this commit): seats, zones, and the two decks.
 */
export const TABLE_SCHEMA_VERSION = 1;

export interface CardTable {
	schemaVersion: number;
	/** Seat ids in table order. Seat *identity* is the shell's; the engine only
	 * needs to know which zones exist and who owns them. */
	seats: string[];
	/** Every zone on the table, by id. */
	zones: Record<string, Zone>;
}

/**
 * What the engine needs from `data/deck.json`. Declared structurally rather than
 * imported from the pack schemas so this module depends on nothing — the caller
 * passes the parsed pack, which is compatible.
 */
export interface DeckDefinition {
	minors: readonly { id: string }[];
	majors: readonly { id: string }[];
	decks: readonly {
		id: string;
		arcana: 'minor' | 'major';
		includesMajors?: readonly string[];
		excludesMajors?: readonly string[];
	}[];
}

/**
 * The card ids each physical deck holds, per ch.1: the player deck is the
 * fifty-six minors *plus the Fool* borrowed from the majors, and the GM deck is
 * what is left of the majors.
 *
 * Derived from the pack rather than hardcoded, so a pack that describes the
 * split differently gets the split it describes.
 */
export function buildDecks(deck: DeckDefinition): { player: string[]; gm: string[] } {
	const majorIds = deck.majors.map((m) => m.id);
	const forDeck = (id: string): string[] => {
		const def = deck.decks.find((d) => d.id === id);
		if (!def) return [];
		const base = def.arcana === 'minor' ? deck.minors.map((c) => c.id) : majorIds;
		const included = def.includesMajors ?? [];
		const excluded = new Set(def.excludesMajors ?? []);
		return [...base.filter((c) => !excluded.has(c)), ...included];
	};
	return { player: forDeck('player'), gm: forDeck('gm') };
}

/**
 * A fresh table: four table zones, per-seat zones for each seat given, and both
 * draw piles stocked in pack order.
 *
 * Deliberately *unshuffled* — shuffling is an operation with a seed, and the
 * seed is the caller's to hold. A table created and never shuffled deals in
 * pack order, which is wrong for play and exactly right for a test.
 */
export function createTable(deck: DeckDefinition, seats: readonly string[] = []): CardTable {
	const zones: Record<string, Zone> = {};
	for (const zone of tableZones()) zones[zone.id] = zone;
	for (const seat of seats) for (const zone of seatZones(seat)) zones[zone.id] = zone;

	const decks = buildDecks(deck);
	zones['deck:player'] = { ...zones['deck:player'], cards: decks.player };
	zones['deck:gm'] = { ...zones['deck:gm'], cards: decks.gm };

	return { schemaVersion: TABLE_SCHEMA_VERSION, seats: [...seats], zones };
}

/** A table with a seat added, and its zones created. Pure. */
export function addSeat(table: CardTable, seat: string): CardTable {
	if (table.seats.includes(seat)) return table;
	const zones = { ...table.zones };
	for (const zone of seatZones(seat)) zones[zone.id] = zone;
	return { ...table, seats: [...table.seats, seat], zones };
}

/**
 * A table with a seat removed. Its cards go nowhere on their own — the caller
 * decides where they land, because "the player left, put their hand in the
 * discard" is a table decision and not the engine's to make.
 */
export function removeSeat(table: CardTable, seat: string): CardTable {
	const zones = Object.fromEntries(Object.entries(table.zones).filter(([, z]) => z.owner !== seat));
	return { ...table, seats: table.seats.filter((s) => s !== seat), zones };
}

/**
 * Bring a saved blob up to the current shape.
 *
 * v1 is the first shape, so there is nothing to convert yet and this is the
 * seam rather than the work. It still runs on every read: a blob written by a
 * *newer* version than this build (a rollback, a stale worker) keeps its own
 * version rather than being silently relabelled, so a mismatch surfaces instead
 * of corrupting quietly.
 */
export function migrateTable(raw: CardTable): CardTable {
	if (raw.schemaVersion > TABLE_SCHEMA_VERSION) return raw;
	return { ...raw, schemaVersion: TABLE_SCHEMA_VERSION };
}
