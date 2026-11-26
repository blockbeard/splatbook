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
import { discardAll } from './moves';
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
 * v12: the scene's `picture`, a reference to an uploaded image.
 * v13: `enemyHealth`, whether players see enemy Health and Defense.
 * v14: no split groups. A group shares one initiative wherever its creatures
 *   stand, so any split-off group is rejoined to its family.
 * v15: the round as steps — `round.step`, `acted`, `answered`,
 *   `shown`, `playedHere` in place of the hand-run count's `minorActions`,
 *   `settled`, `interrupt` and `extraTurn`; a `minor` zone per seat and
 *   group; `plays` and `minorDeclared`; and `guided` gone, since the steps are
 *   the guide.
 * v16: `minorTargets`, who a face-down minor action is aimed at, from the
 *   second live test (25 November 2026).
 * v17 (this commit): a play's `adds`, whether its total adds the attribute.
 */
export const TABLE_SCHEMA_VERSION = 17;

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
/** What a card on the table was played for. See `CardTable.plays`. */
export interface Play {
	/** The seat or enemy group that played it. */
	by: string;
	/** The action, as its player named it. */
	action: string;
	/** Who it was aimed at, if anyone was named: a seat, a group or a creature. */
	target?: string;
	kind: 'turn' | 'minor' | 'readied' | 'out-of-turn';
	/**
	 * Whether the card's total adds the player's attribute (v17, phase 33). The
	 * book: "On your turn, your action's total value equals the card's face value
	 * _plus_ the associated attribute", and "A minor action's total value equals
	 * the card's face value". So a turn adds it, and an out-of-turn play does
	 * (the Fool's extra turn is a turn); a minor action doesn't; a readied card
	 * goes by where it was put down, above the initiative on your turn (adds) or
	 * below it as a minor (face value). The table adds nothing itself: it only
	 * says which kind each card is. Absent on a play stored before v17, which
	 * shows neither.
	 */
	adds?: boolean;
	/** The initiative number it was played at. */
	number: number | null;
}

export interface Opponent {
	id: string;
	name: string;
	/**
	 * Which family the group's letters come from — its own id. Groups used to
	 * split, and a split-off group kept its family's letters; since v14 there is
	 * no splitting, and every group is its own family.
	 */
	family: string;
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
	 * What each face-up card in a played pile was played for, by card id: who,
	 * the action, at whom, and whether on a turn, as a minor action, readied, or
	 * out of turn. Card ids are the cards' identities, which is safe only because
	 * these cards lie face up; a face-down minor action is labelled by its zone
	 * in `minorDeclared` until it is turned over.
	 */
	plays: Record<string, Play>;
	/** The declared action of each face-down minor-action card, by zone. Public, as the book has it. */
	minorDeclared: Record<string, string>;
	/**
	 * Who a face-down minor action is aimed at, by zone: a seat, a group or a
	 * creature. Public, as the declaration is; it passes to the card's `plays`
	 * label when the minor actions turn over, and turns the target's initiative
	 * face up then.
	 */
	minorTargets: Record<string, string>;
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
	/**
	 * Whether the players see the enemies' Health and Defense. The GM's switch,
	 * shown by default (Chris, 25 November 2026). While shown, anyone may change
	 * it, so a player can catch a miscount; while hidden, players are sent none
	 * of it and only the GM changes it. Down is seen either way.
	 */
	enemyHealth: 'shown' | 'hidden';
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
		plays: {},
		minorDeclared: {},
		minorTargets: {},
		scene: emptyScene(),
		enemyHealth: 'shown',
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
	// Their cards go to the discards first. Deleting a zone that still held a
	// hand took those cards out of the game, and the deck counts stopped adding
	// up for the rest of the session.
	let cleared = table;
	const usual = seat === table.gmSeat ? 'gm' : 'player';
	for (const zone of Object.values(table.zones)) {
		if (zone.owner === seat) cleared = discardAll(cleared, zone.id, usual);
	}
	const zones = Object.fromEntries(
		Object.entries(cleared.zones).filter(([, z]) => z.owner !== seat)
	);
	const facedown = Object.fromEntries(
		Object.entries(cleared.facedown).filter(([zid]) => !zid.startsWith(`seat:${seat}:`))
	);
	return forgetPlacements(
		{ ...cleared, seats: cleared.seats.filter((s) => s !== seat), zones, facedown },
		[seat]
	);
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
 * v16 → v17: nothing moves. A play stored before `adds` has none, and the
 * table shows neither "+ attribute" nor "face value" for it, which is honest:
 * nobody recorded which it was.
 *
 * v15 → v16: no minor-action targets yet.
 *
 * v14 → v15: the round in steps; see `migrateRound`. A `minor` zone for every
 * seat and group, empty `plays` and `minorDeclared`; `guided` is dropped.
 *
 * v13 → v14: split-off groups rejoin their families — see `rejoinSplitGroups`,
 * which the game module runs after this.
 *
 * v12 → v13: `enemyHealth: 'shown'`, which is what every table did before.
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
	// `guided` went in v15: the steps are the guide now.
	const { guided: _guided, ...migrated } = migrateShape(raw) as CardTable & { guided?: unknown };
	return { ...migrated, round: migrateRound(raw.round, migrated) };
}

/**
 * v14 → v15: a round run by hand becomes a round in steps.
 *
 * Not a reconstruction of what happened — the old round never recorded who had
 * acted — but the obvious reading of where the count stood: before a deal it
 * is the deal; dealt but not counting, it is initiative; counting, everyone
 * below the number has acted and everyone at or below it is face up, and it is
 * the turn of whoever holds the number. The GM can move it on from there.
 */
function migrateRound(raw: Partial<Round> | undefined, table: CardTable): Round {
	const base = { ...newRound(), ...(raw ?? {}) } as Round & Record<string, unknown>;
	const current: Round = {
		number: base.number,
		count: base.count,
		foolDrawn: base.foolDrawn,
		step: base.step,
		acted: base.acted ?? [],
		answered: base.answered ?? [],
		shown: base.shown ?? [],
		playedHere: base.playedHere ?? false
	};
	if (raw && 'step' in raw && raw.step) return current;

	if (current.number === 0) return { ...current, step: 'deal' };
	if (current.count === null) return { ...current, step: 'initiative' };
	const count = current.count;
	const values: [string, number][] = [];
	for (const seat of table.seats) {
		const card = table.zones[`seat:${seat}:initiative`]?.cards[0];
		if (card !== undefined) values.push([seat, table.valueOf[card] ?? 0]);
	}
	for (const opponent of table.opponents) {
		const card = table.zones[`opponent:${opponent.id}:initiative`]?.cards[0];
		if (card !== undefined) values.push([opponent.id, table.valueOf[card] ?? 0]);
	}
	return {
		...current,
		step: 'turn',
		acted: values.filter(([, v]) => v < count).map(([h]) => h),
		shown: values.filter(([, v]) => v <= count).map(([h]) => h)
	};
}

function migrateShape(raw: CardTable): CardTable {
	const opponents = (raw.opponents ?? []).map(migrateOpponent);
	const seats = raw.seats ?? [];
	return {
		...raw,
		// Defaulted rather than assumed. A blob can arrive from a version that
		// never had these, and a table whose `seats` is undefined is not merely
		// empty — it throws the moment anything iterates it.
		seats,
		gmSeat: raw.gmSeat ?? null,
		opponents,
		mode: raw.mode ?? 'decks',
		deckOf: raw.deckOf ?? {},
		valueOf: raw.valueOf ?? {},
		// v15: what played cards were for starts unknown, which is true of them.
		plays: raw.plays ?? {},
		minorDeclared: raw.minorDeclared ?? {},
		// v16: nobody had named a target before there was a place to.
		minorTargets: raw.minorTargets ?? {},
		round: newRound(),
		facedown: raw.facedown ?? {},
		scene: migrateScene(raw.scene),
		// v13: everyone saw Health before there was a switch.
		enemyHealth: raw.enemyHealth === 'hidden' ? 'hidden' : 'shown',
		// Two migrations in one pass: every zone gains a `reach` (v5), and any
		// table zone the blob predates is added (v7).
		// v15: any seat or group zone the blob predates, such as `minor`, is
		// added empty.
		zones: withHolderZones(
			withTableZones(
				Object.fromEntries(
					Object.entries(raw.zones ?? {}).map(([id, zone]) => [
						id,
						{ ...zone, reach: zone.reach ?? (id.endsWith(':hand') ? 'owner' : 'table') }
					])
				)
			),
			seats,
			opponents.map((o) => o.id)
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

/** Add any seat or group zone a stored blob predates, leaving what it has alone. */
function withHolderZones(
	zones: Record<string, Zone>,
	seats: readonly string[],
	opponents: readonly string[]
): Record<string, Zone> {
	const next = { ...zones };
	for (const seat of seats) {
		for (const zone of seatZones(seat)) if (!next[zone.id]) next[zone.id] = zone;
	}
	for (const opponent of opponents) {
		for (const zone of opponentZones(opponent)) if (!next[zone.id]) next[zone.id] = zone;
	}
	return next;
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
	// Its initiative and played cards go to the discards, not out of the game.
	let cleared = table;
	for (const zid of Object.keys(table.zones)) {
		if (zid.startsWith(prefix)) cleared = discardAll(cleared, zid, 'gm');
	}
	return forgetPlacements(
		{
			...cleared,
			opponents: cleared.opponents.filter((o) => o.id !== id),
			zones: Object.fromEntries(
				Object.entries(cleared.zones).filter(([zid]) => !zid.startsWith(prefix))
			),
			facedown: Object.fromEntries(
				Object.entries(cleared.facedown).filter(([zid]) => !zid.startsWith(prefix))
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
		creatures
	};
}
