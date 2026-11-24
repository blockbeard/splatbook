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
import {
	MAX_CREATURES,
	letterIndex,
	makeCreatures,
	migrateCreature,
	type Creature
} from './creatures';
import { emptyScene, forgetPlacements, migrateScene, type Scene } from './scene';
import { deckZone, opponentZones, seatZones, tableZones, type DeckId, type Zone } from './zones';

/**
 * Bump on any change to the saved shape, in the same commit as the change, and
 * extend `migrateTable` with a test that loads a fixture of the old shape.
 *
 * v1: seats, zones, and the two decks.
 * v2: `gmSeat` and `opponents`.
 * v3: `round` and `foolCards`.
 * v4: `facedown`, and the round's `interrupt` / `extraTurn`.
 * v5: `reach` on every zone.
 * v6: `mode`.
 * v7: a shared `fate` zone.
 * v8: `deckOf`, which deck each card belongs to.
 * v9: `guided`, and `valueOf` so the count can find who is up.
 * v10: `scene` — the book's zones, and who stands in which.
 * v11: an opponent holds `creatures`, with letters and HD, and its `count` is
 *   no longer stored but derived from the creatures still up.
 * v12 (this commit): the scene's `picture`, a reference to an uploaded image.
 */
export const TABLE_SCHEMA_VERSION = 12;

/**
 * An enemy, or a group of them, that the GM plays.
 *
 * Not a seat: the GM draws one hand of majors and plays from it for everything
 * they control, because ch.7 says "it's not practical to draw four cards per
 * opponent". So an opponent has an initiative slot, a played pile and a
 * facedown slot, and no hand at all.
 *
 * A group is the unit that takes a turn; its creatures are the bodies, each
 * with a letter, a zone and its own Health and Defense. See `creatures.ts`.
 */
export interface Opponent {
	id: string;
	name: string;
	/**
	 * The group this one descends from by splitting — itself, for a group the GM
	 * added. Letters are handed out across a family, so a split-off group that
	 * gains reinforcements does not mint a second Zombie C.
	 */
	family: string;
	/** The group this one was split from, which is where a merge sends it back. */
	splitFrom?: string;
	creatures: Creature[];
}

/**
 * How many of a group's creatures are still up. The mob rule turns on it, and
 * so does the GM's draw ("+1 if the enemies outnumber the adventurers"), which
 * ch.7 rechecks every round — so a number that falls as creatures go down is
 * what the book asks for. Derived, never stored, so it cannot drift.
 */
export function upCount(opponent: Opponent): number {
	return opponent.creatures.filter((c) => !c.down).length;
}

/** The index of the next unused letter in a family, across all its groups. */
export function nextLetterIndex(table: CardTable, family: string): number {
	let next = 0;
	for (const opponent of table.opponents) {
		if (opponent.family !== family) continue;
		for (const creature of opponent.creatures) {
			next = Math.max(next, letterIndex(creature.letter) + 1);
		}
	}
	return next;
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
	 * Which deck each card belongs to.
	 *
	 * The table lets you put a card on the wrong discard, because a physical one
	 * does and because picking it back up is how you fix a mistake. What a
	 * physical table does *not* do is shuffle a minor arcana card into the major
	 * deck and leave it there — and that was the failure: a stray card became
	 * permanent the moment somebody shuffled, with no way back.
	 *
	 * So membership is a fact about the card, kept here, and a shuffle uses it.
	 * Taken from the pack, like `foolCards`, rather than inferred.
	 */
	deckOf: Record<string, DeckId>;
	/** Each card's value, so the count can tell whose initiative it has reached. */
	valueOf: Record<string, number>;
	/**
	 * Whether the table is walking the round for you.
	 *
	 * Off by default and the GM's to turn on. Guided mode is a pointer and a set
	 * of shortcuts over the same free table — it never gates a command, so a
	 * table with it on can still be played entirely by hand.
	 */
	guided: boolean;
	/**
	 * What each facedown card is *for*, keyed by its zone.
	 *
	 * Kept beside the zones rather than inside them because a zone holds card
	 * ids and nothing else, and this is not about the card — it is the declared
	 * action, which ch.7 makes public, and the position that decides what the
	 * card is worth when it turns over.
	 */
	facedown: Record<string, FacedownAction>;
	/**
	 * The room the fight is in: the zones the GM named and who is standing in
	 * which. Survives leaving a Challenge, and goes only with "New scene" or a
	 * reset. See `scene.ts`.
	 */
	scene: Scene;
	/** Every zone on the table, by id. */
	zones: Record<string, Zone>;
}

/**
 * What the engine needs from `data/deck.json`. Declared structurally rather than
 * imported from the pack schemas so this module depends on nothing — the caller
 * passes the parsed pack, which is compatible.
 */
export interface DeckDefinition {
	minors: readonly { id: string; value: number }[];
	majors: readonly { id: string; value: number }[];
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
		deckOf: membershipOf(deck),
		valueOf: valuesOf(deck),
		guided: false,
		scene: emptyScene(),
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
	return forgetPlacements({ ...table, seats: table.seats.filter((s) => s !== seat), zones }, [
		seat
	]);
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
 * v11 → v12: a scene gains `picture: null`; see `migrateScene`.
 *
 * v10 → v11: groups gain creatures; see `migrateOpponent`.
 *
 * v9 → v10: an empty scene. Nobody was placed anywhere before, which is true.
 *
 * v6 → v7: a table that predates the fate pile gains an empty one. Nothing
 * moves: cards that already went to a discard belong there.
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
		opponents: (raw.opponents ?? []).map(migrateOpponent),
		mode: raw.mode ?? 'decks',
		deckOf: raw.deckOf ?? {},
		valueOf: raw.valueOf ?? {},
		guided: raw.guided ?? false,
		round: { ...newRound(), ...(raw.round ?? {}) },
		facedown: raw.facedown ?? {},
		scene: migrateScene(raw.scene),
		// Two migrations in one pass: every zone gains a `reach` (v5), and any
		// table zone the blob predates is added (v7).
		zones: withTableZones(
			Object.fromEntries(
				Object.entries(raw.zones ?? {}).map(([id, zone]) => [
					id,
					{ ...zone, reach: zone.reach ?? (id.endsWith(':hand') ? 'owner' : 'table') }
				])
			)
		),
		foolCards: raw.foolCards ?? [],
		schemaVersion: TABLE_SCHEMA_VERSION
	};
}

/** Each card's value, from the pack. */
export function valuesOf(deck: DeckDefinition): Record<string, number> {
	const map: Record<string, number> = {};
	for (const card of deck.minors) map[card.id] = card.value;
	for (const card of deck.majors) map[card.id] = card.value;
	return map;
}

/** Which deck each card belongs to, from the pack's own split. */
export function membershipOf(deck: DeckDefinition): Record<string, DeckId> {
	const decks = buildDecks(deck);
	const map: Record<string, DeckId> = {};
	for (const card of decks.player) map[card] = 'player';
	for (const card of decks.gm) map[card] = 'gm';
	return map;
}

/** Add any table zone a stored blob predates, leaving what it has alone. */
function withTableZones(zones: Record<string, Zone>): Record<string, Zone> {
	const next = { ...zones };
	for (const zone of tableZones()) if (!next[zone.id]) next[zone.id] = zone;
	return next;
}

/**
 * Reseed the facts about the deck that a stored blob cannot carry — which cards
 * trigger the end-of-round reshuffle, and which deck each card belongs to.
 *
 * Neither is recoverable from an old blob, because the deck definition was
 * never in it. The pack is the authority, so the caller supplies it on read.
 */
export function withDeckFacts(table: CardTable, deck: DeckDefinition): CardTable {
	const fools = deck.decks.find((d) => d.id === 'player')?.includesMajors ?? [];
	return {
		...table,
		foolCards: [...fools],
		deckOf: membershipOf(deck),
		valueOf: valuesOf(deck)
	};
}

/** The table with a given seat running it. Pass `null` to vacate the seat. */
export function setGmSeat(table: CardTable, seat: string | null): CardTable {
	return { ...table, gmSeat: seat };
}

/**
 * Add an enemy, or a group of them, with its zones. Works whenever it is
 * called: the scene is set at the start, but reinforcements arrive.
 *
 * `count` creatures are made, lettered from A, each with the same Health and
 * Defense if the GM gave them — HD is optional, and a creature without it is
 * simply not tracked. At most `MAX_CREATURES`.
 */
export function addOpponent(
	table: CardTable,
	opponent: { id: string; name: string; count?: number; health?: number; defense?: number }
): CardTable {
	if (table.opponents.some((o) => o.id === opponent.id)) return table;
	const count = Math.max(1, Math.min(MAX_CREATURES, Math.floor(opponent.count ?? 1)));
	const hd =
		opponent.health === undefined && opponent.defense === undefined
			? undefined
			: { health: opponent.health, defense: opponent.defense };
	const zones = { ...table.zones };
	for (const zone of opponentZones(opponent.id)) zones[zone.id] = zone;
	return {
		...table,
		opponents: [
			...table.opponents,
			{
				id: opponent.id,
				name: opponent.name,
				family: opponent.id,
				creatures: makeCreatures(opponent.id, 0, count, hd)
			}
		],
		zones
	};
}

/**
 * Remove an opponent and its zones. Any cards it held go nowhere on their own —
 * where they land is a table decision, the same as for a departing seat. Its
 * creatures leave the scene with it.
 */
export function removeOpponent(table: CardTable, id: string): CardTable {
	const prefix = `opponent:${id}:`;
	const gone = table.opponents.find((o) => o.id === id);
	return forgetPlacements(
		{
			...table,
			opponents: table.opponents.filter((o) => o.id !== id),
			zones: Object.fromEntries(
				Object.entries(table.zones).filter(([zid]) => !zid.startsWith(prefix))
			)
		},
		gone?.creatures.map((c) => c.id) ?? []
	);
}

/** Rename an opponent. How many it stands for is its creatures, not a number. */
export function updateOpponent(table: CardTable, id: string, patch: { name?: string }): CardTable {
	const name = patch.name?.trim();
	if (!name) return table;
	return {
		...table,
		opponents: table.opponents.map((o) => (o.id === id ? { ...o, name } : o))
	};
}

/**
 * Move some of a group's creatures into a new group of their own — for when
 * they start acting apart, like the zombie the King of Swords raised, which
 * drew its own initiative. Creatures standing in different zones do *not* need
 * this: the zone is the creature's, not the group's.
 *
 * The new group starts with empty card slots; the original keeps its cards.
 * The creatures keep their ids and letters, so Zombie C is still Zombie C and
 * still standing where it stood. Splitting nobody, or everybody, does nothing:
 * the first is no change and the second is a rename.
 */
export function splitOpponent(
	table: CardTable,
	id: string,
	split: { id: string; name?: string; creatures: readonly string[] }
): CardTable {
	const source = table.opponents.find((o) => o.id === id);
	if (!source || table.opponents.some((o) => o.id === split.id)) return table;
	const moving = new Set(split.creatures);
	const leaving = source.creatures.filter((c) => moving.has(c.id));
	const staying = source.creatures.filter((c) => !moving.has(c.id));
	if (leaving.length === 0 || staying.length === 0) return table;

	const zones = { ...table.zones };
	for (const zone of opponentZones(split.id)) zones[zone.id] = zone;
	const at = table.opponents.findIndex((o) => o.id === id);
	const opponents = [...table.opponents];
	opponents[at] = { ...source, creatures: staying };
	opponents.splice(at + 1, 0, {
		id: split.id,
		name: split.name?.trim() || source.name,
		family: source.family,
		splitFrom: source.id,
		creatures: leaving
	});
	return { ...table, opponents, zones };
}

/**
 * Bring a stored opponent into shape.
 *
 * v10 → v11: a group stored as a bare `count` becomes that many creatures,
 * lettered from A, with no HD tracked — the honest state of a group whose HD
 * nobody had anywhere to write down. Capped at `MAX_CREATURES`: the old command
 * accepted 999, and a thousand creatures would ride along in every poll.
 */
function migrateOpponent(raw: Partial<Opponent> & { count?: number }): Opponent {
	const id = String(raw.id);
	const family = typeof raw.family === 'string' ? raw.family : id;
	const creatures = Array.isArray(raw.creatures)
		? raw.creatures.map(migrateCreature).filter((c): c is Creature => c !== null)
		: makeCreatures(family, 0, Math.max(1, Math.min(MAX_CREATURES, Math.floor(raw.count ?? 1))));
	return {
		id,
		name: String(raw.name ?? ''),
		family,
		...(typeof raw.splitFrom === 'string' ? { splitFrom: raw.splitFrom } : {}),
		creatures
	};
}
