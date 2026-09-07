/**
 * The card table's state: what is saved, how it is created, and how it migrates.
 *
 * Pure — no UI, no DB, no `Math.random`. The shell persists whatever this
 * returns as an opaque blob and calls `migrateTable` on every read, exactly as
 * it calls a game's `migrate*` for an entity. A table is long-lived (six weeks),
 * so the migration is not paperwork: a shape change shipped mid-phase would
 * otherwise break a table that people are sitting at mid-round.
 */

import type { FacedownAction } from './exceptions';
import type { TableMode } from './mode';
import { newRound, type Round } from './round';
import { deckZone, opponentZones, seatZones, tableZones, type Zone } from './zones';

/**
 * Bump on any change to the saved shape, in the same commit as the change, and
 * extend `migrateTable` with a test that loads a fixture of the old shape.
 *
 * v1: seats, zones, and the two decks.
 * v2: `gmSeat` and `opponents`.
 * v3: `round` and `foolCards`.
 * v4: `facedown`, and the round's `interrupt` / `extraTurn`.
 * v5: `reach` on every zone.
 * v6 (this commit): `mode`.
 */
export const TABLE_SCHEMA_VERSION = 6;

/**
 * An enemy, or a group of them, that the GM plays.
 *
 * Not a seat: the GM draws one hand of majors and plays from it for everything
 * they control, because ch.7 says "it's not practical to draw four cards per
 * opponent". So an opponent has an initiative slot, a played pile and a
 * facedown slot, and no hand at all.
 */
export interface Opponent {
	id: string;
	name: string;
	/**
	 * How many creatures this entry stands for. The mob rules turn on it — two
	 * enemies on one adventurer grant favour, four add piercing, eight critical
	 * — and it feeds the GM's draw ("+1 if the enemies outnumber the
	 * adventurers"). The engine stores it and counts nothing: the arithmetic is
	 * the GM's, and the checklist only ever suggests.
	 */
	count: number;
}

export interface CardTable {
	schemaVersion: number;
	/** Seat ids in table order. Seat *identity* is the shell's; the engine only
	 * needs to know which zones exist and who owns them. */
	seats: string[];
	/**
	 * Which seat is running the game, if any. Held as a pointer rather than
	 * baked into zone ownership because the seat changes hands: a vacant GM
	 * seat may be claimed by anyone, and every opponent zone would otherwise
	 * need rewriting on each handover.
	 */
	gmSeat: string | null;
	/** The enemies in play, in the order the GM added them. */
	opponents: Opponent[];
	/** Which view is up. The decks are shared by both, deliberately. */
	mode: TableMode;
	/** Where the round has got to. `number: 0` before the first one. */
	round: Round;
	/**
	 * The cards whose drawing shuffles both decks at the end of the round — the
	 * Fool, and whatever else a future pack borrows between decks.
	 *
	 * Taken from the pack rather than written here as `'fool'`: the pack already
	 * says which majors are lent to the player deck, and the engine has no
	 * business knowing a card id by name.
	 */
	foolCards: string[];
	/**
	 * What each facedown card is *for*, keyed by its zone.
	 *
	 * Kept beside the zones rather than inside them because a zone holds card
	 * ids and nothing else, and this is not about the card — it is the declared
	 * action, which ch.7 makes public, and the position that decides what the
	 * card is worth when it turns over.
	 */
	facedown: Record<string, FacedownAction>;
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

/** The zone id for a deck, without the string literals `createTable` used to use. */
function stock(zones: Record<string, Zone>, id: string, cards: string[]): void {
	zones[id] = { ...zones[id], cards };
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
	stock(zones, deckZone('player'), decks.player);
	stock(zones, deckZone('gm'), decks.gm);

	return {
		schemaVersion: TABLE_SCHEMA_VERSION,
		seats: [...seats],
		gmSeat: null,
		opponents: [],
		mode: 'decks',
		round: newRound(),
		facedown: {},
		foolCards: [...(deck.decks.find((d) => d.id === 'player')?.includesMajors ?? [])],
		zones
	};
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
 * Runs on every read. A blob written by a *newer* version than this build (a
 * rollback, a stale worker) keeps its own version rather than being silently
 * relabelled, so a mismatch surfaces instead of corrupting quietly.
 *
 * v1 → v2: a table that predates opponents gains an empty roster and no GM
 * seat. A live table mid-Challenge keeps its cards; it simply had nobody to
 * fight, which was true of it.
 *
 * v5 → v6: a table that predates the modes opens on the decks, which is what
 * it was.
 *
 * v4 → v5: every zone gains a `reach`. Derived from the zone's own id, since a
 * hand is the only thing nobody else may take from and hands are exactly the
 * zones whose ids end in `:hand`. A migration is the right place for a
 * string-shaped inference like that; everything built afresh declares it.
 *
 * v3 → v4: no facedown declarations, and a round with nobody interrupting and
 * no turn owed. A table mid-round keeps any card already sitting facedown; it
 * simply has no label for it, which is the honest state of a card played before
 * labels existed.
 *
 * v2 → v3: a round that has not started, and no Fool. `foolCards` cannot be
 * recovered from an old blob — the deck definition is not in it — so a migrated
 * table gets an empty list and the caller reseeds it with `withFoolCards` when
 * it next has the pack to hand. An empty list is the safe wrong answer: the
 * worst it does is miss a reshuffle the GM can still press.
 */
export function migrateTable(raw: CardTable): CardTable {
	if (raw.schemaVersion > TABLE_SCHEMA_VERSION) return raw;
	return {
		...raw,
		// Defaulted rather than assumed. A blob can arrive from a version that
		// never had these, and a table whose `seats` is undefined is not merely
		// empty — it throws the moment anything iterates it.
		seats: raw.seats ?? [],
		gmSeat: raw.gmSeat ?? null,
		opponents: raw.opponents ?? [],
		mode: raw.mode ?? 'decks',
		round: { ...newRound(), ...(raw.round ?? {}) },
		facedown: raw.facedown ?? {},
		zones: Object.fromEntries(
			Object.entries(raw.zones ?? {}).map(([id, zone]) => [
				id,
				{ ...zone, reach: zone.reach ?? (id.endsWith(':hand') ? 'owner' : 'table') }
			])
		),
		foolCards: raw.foolCards ?? [],
		schemaVersion: TABLE_SCHEMA_VERSION
	};
}

/** Reseed which cards trigger the end-of-round reshuffle, from the pack. */
export function withFoolCards(table: CardTable, deck: DeckDefinition): CardTable {
	const fools = deck.decks.find((d) => d.id === 'player')?.includesMajors ?? [];
	return { ...table, foolCards: [...fools] };
}

/** The table with a given seat running it. Pass `null` to vacate the seat. */
export function setGmSeat(table: CardTable, seat: string | null): CardTable {
	return { ...table, gmSeat: seat };
}

/**
 * Add an enemy, or a group of them, with its zones. Works whenever it is
 * called: the scene is set at the start, but reinforcements arrive.
 */
export function addOpponent(
	table: CardTable,
	opponent: { id: string; name: string; count?: number }
): CardTable {
	if (table.opponents.some((o) => o.id === opponent.id)) return table;
	const zones = { ...table.zones };
	for (const zone of opponentZones(opponent.id)) zones[zone.id] = zone;
	return {
		...table,
		opponents: [
			...table.opponents,
			{ id: opponent.id, name: opponent.name, count: opponent.count ?? 1 }
		],
		zones
	};
}

/**
 * Remove an opponent and its zones. Any cards it held go nowhere on their own —
 * where they land is a table decision, the same as for a departing seat.
 */
export function removeOpponent(table: CardTable, id: string): CardTable {
	const prefix = `opponent:${id}:`;
	return {
		...table,
		opponents: table.opponents.filter((o) => o.id !== id),
		zones: Object.fromEntries(
			Object.entries(table.zones).filter(([zid]) => !zid.startsWith(prefix))
		)
	};
}

/** Rename an opponent, or change how many it stands for. */
export function updateOpponent(
	table: CardTable,
	id: string,
	patch: { name?: string; count?: number }
): CardTable {
	return {
		...table,
		opponents: table.opponents.map((o) => (o.id === id ? { ...o, ...patch } : o))
	};
}

/**
 * Peel some of a group off into a new entry — the six unwolves become five and
 * one, because they are no longer all on the same adventurer and the mob rules
 * count per target.
 *
 * The new entry starts with empty slots; the original keeps its cards. Splitting
 * a group of one, or taking more than it has, does nothing: there is no such
 * table state, so there is nothing to represent.
 */
export function splitOpponent(
	table: CardTable,
	id: string,
	split: { id: string; name?: string; count: number }
): CardTable {
	const source = table.opponents.find((o) => o.id === id);
	if (!source || split.count < 1 || split.count >= source.count) return table;
	const reduced = updateOpponent(table, id, { count: source.count - split.count });
	return addOpponent(reduced, {
		id: split.id,
		name: split.name ?? source.name,
		count: split.count
	});
}
