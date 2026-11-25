/**
 * His Majesty the Worm's card table, as the shell sees it.
 *
 * The thin layer between the shell's plumbing and the engine: it turns a
 * validated command into an engine call, and the engine's state into the view
 * one seat may have. Everything it knows about cards it gets from the engine;
 * everything it knows about seats and versions it is told.
 *
 * **The public-log contract.** Whatever this returns as `data` is stored
 * verbatim and shown to the whole table, and the shell cannot tell a card id
 * from a zone id. So nothing here ever puts a card in an event. Zones, counts
 * and seat ids only — "a card went from the player deck to its discard", never
 * which card. Anyone who needs to know what the card was can see it in their own
 * projection, if they are entitled to.
 */

import { z } from 'zod';
import type { CardTableModule, CardTableOutcome } from '../types';
import {
	MAX_CREATURES,
	MAX_HD,
	MAX_SCENE_ZONES,
	MAX_SCENE_ZONE_NAME,
	TABLE_SCHEMA_VERSION,
	addCreatures,
	creatureLabel,
	findCreature,
	mergeOpponent,
	placeInScene,
	placeable,
	removeCreature,
	setDown,
	setHd,
	setScenePicture,
	setSceneZones,
	splitOpponent,
	FATE_ZONE,
	addOpponent,
	addSeat,
	advanceCount,
	beginRound,
	clearFacedown,
	clearScene,
	createTable,
	discardAll,
	endRound,
	migrateTable,
	moveCard,
	mulliganGmHand,
	opponentZone,
	placeFacedown,
	projectFor,
	removeOpponent,
	removeSeat,
	reshuffleDeck,
	revealFacedown,
	rewindCount,
	seatZone,
	setCount,
	setGmSeat,
	setMinorActions,
	setMode,
	updateOpponent,
	withDeckFacts,
	type CardTable,
	type DeckDefinition
} from './engine';

/** A Health or Defense value. */
const hd = z.number().int().min(0).max(MAX_HD);

/** The zone-id shape the engine uses. Kept loose: the engine owns the vocabulary. */
const zoneId = z.string().min(1).max(120);

/**
 * What a client may ask for.
 *
 * Small on purpose. This is the vocabulary Decks mode needs; the Challenge
 * commands arrive with the mode that uses them. Everything is a move at heart —
 * flipping the top of a deck into its discard and revealing a facedown card are
 * the same operation to the engine, so they are the same command here.
 */
export const commandSchema = z.discriminatedUnion('type', [
	/** Move one card. Naming a card is only accepted where the asker may see it. */
	z.strictObject({
		type: z.literal('move'),
		from: z.strictObject({ zone: zoneId, card: z.string().min(1).max(120).optional() }),
		to: zoneId
	}),
	/** Shuffle a deck's discard back into it. */
	z.strictObject({ type: z.literal('reshuffle'), deck: z.enum(['player', 'gm']) }),
	/** Everything back in the decks, shuffled. The GM's, and it confirms first. */
	z.strictObject({ type: z.literal('reset-table') }),
	/** Sweep the turned-over cards into the discard once the test is settled. */
	z.strictObject({ type: z.literal('clear-fate') }),
	/** Let the table walk the round, or stop it. The GM's, and never a gate. */
	z.strictObject({ type: z.literal('guided'), on: z.boolean() }),

	/* ---- The Challenge ---------------------------------------------------- */

	/**
	 * Switch views. Leaving a Challenge sweeps the table, which is why the
	 * interface confirms first — this is the one command that destroys work.
	 */
	z.strictObject({ type: z.literal('set-mode'), mode: z.enum(['decks', 'challenge']) }),
	/** Deal a round. The GM's number is theirs to decide; the checklist suggests. */
	z.strictObject({
		type: z.literal('begin-round'),
		playerHand: z.number().int().min(0).max(20),
		gmHand: z.number().int().min(0).max(30)
	}),
	z.strictObject({ type: z.literal('end-round') }),
	/** Discard the GM's hand and draw the same number again. */
	z.strictObject({ type: z.literal('mulligan') }),
	/** Call an initiative number, or stop counting. */
	z.strictObject({
		type: z.literal('set-count'),
		count: z.number().int().min(1).max(30).nullable()
	}),
	z.strictObject({ type: z.literal('advance-count') }),
	z.strictObject({ type: z.literal('rewind-count') }),
	/** Open or shut the window in which anyone may declare a minor action. */
	z.strictObject({ type: z.literal('minor-actions'), open: z.boolean() }),
	/** Move everything played face up into the discard. Ch.7's Sweep. */
	z.strictObject({ type: z.literal('sweep') }),
	/** Name an enemy, or a group of them. */
	z.strictObject({
		type: z.literal('add-opponent'),
		id: z.string().min(1).max(60),
		name: z.string().min(1).max(60),
		count: z.number().int().min(1).max(MAX_CREATURES),
		/** Given once for the type; every creature in the group starts with it. */
		health: hd.optional(),
		defense: hd.optional()
	}),
	z.strictObject({ type: z.literal('remove-opponent'), id: z.string().min(1).max(60) }),
	z.strictObject({
		type: z.literal('update-opponent'),
		id: z.string().min(1).max(60),
		name: z.string().min(1).max(60)
	}),
	/** Lay a card down, declaring what it is for. The label is public. */
	z.strictObject({
		type: z.literal('place-facedown'),
		holder: z.string().min(1).max(60),
		from: z.strictObject({ zone: zoneId, card: z.string().min(1).max(120).optional() }),
		position: z.enum(['turn', 'minor']),
		label: z.string().min(1).max(60)
	}),
	z.strictObject({ type: z.literal('reveal-facedown'), holder: z.string().min(1).max(60) }),
	z.strictObject({ type: z.literal('clear-facedown'), holder: z.string().min(1).max(60) }),

	/* ---- The scene and its creatures (phase 31) ------------------------------ */

	/** Name the scene's zones. The GM's. A zone keeps its occupants while it keeps its id. */
	z.strictObject({
		type: z.literal('set-scene-zones'),
		zones: z
			.array(
				z.strictObject({
					id: z.string().min(1).max(60),
					name: z.string().min(1).max(MAX_SCENE_ZONE_NAME)
				})
			)
			.max(MAX_SCENE_ZONES)
	}),
	/**
	 * Put up the scene's picture, or take it down. The GM's, and sent by the
	 * shell's picture endpoint after it has stored the bytes — a client that
	 * sends it directly names a picture that does not exist, and gets nothing.
	 */
	z.strictObject({
		type: z.literal('set-scene-picture'),
		id: z.string().uuid(),
		mime: z.enum(['image/png', 'image/jpeg', 'image/webp'])
	}),
	z.strictObject({ type: z.literal('clear-scene-picture') }),
	/** A new scene: no zones, nobody placed. The GM's. */
	z.strictObject({ type: z.literal('clear-scene') }),
	/** Stand an adventurer or a creature in a zone, or nowhere. Anyone's. */
	z.strictObject({
		type: z.literal('place'),
		who: z.string().min(1).max(120),
		zone: z.string().min(1).max(60).nullable()
	}),
	/** More of a group, lettered on. */
	z.strictObject({
		type: z.literal('add-creatures'),
		id: z.string().min(1).max(60),
		count: z.number().int().min(1).max(MAX_CREATURES),
		health: hd.optional(),
		defense: hd.optional()
	}),
	/** Take off a creature added by mistake. */
	z.strictObject({ type: z.literal('remove-creature'), creature: z.string().min(1).max(120) }),
	/** "Zombie B, Health 3 → 2". Carries what it replaces, so a double click cannot land twice. */
	z.strictObject({
		type: z.literal('set-hd'),
		creature: z.string().min(1).max(120),
		pool: z.number().int().min(0).max(9),
		stat: z.enum(['health', 'defense']),
		from: hd,
		to: hd
	}),
	/** Whether the players see enemy Health and Defense. The GM's. */
	z.strictObject({ type: z.literal('enemy-health'), shown: z.boolean() }),
	/** Down, or back up. The GM's, and anyone's while Health is shown. */
	z.strictObject({
		type: z.literal('set-down'),
		creature: z.string().min(1).max(120),
		down: z.boolean()
	}),
	/** Some of a group start acting on their own. The GM's. */
	z.strictObject({
		type: z.literal('split-opponent'),
		id: z.string().min(1).max(60),
		newId: z.string().min(1).max(60),
		name: z.string().min(1).max(60).optional(),
		creatures: z.array(z.string().min(1).max(120)).min(1).max(MAX_CREATURES)
	}),
	/** A split-off group rejoins the one it came from. The GM's. */
	z.strictObject({ type: z.literal('merge-opponent'), id: z.string().min(1).max(60) })
]);

export type CardTableCommand = z.infer<typeof commandSchema>;

const fail = (reason: string): CardTableOutcome => ({ ok: false, reason });

/**
 * The commands that run the table rather than play on it: the round, the
 * count, the decks, the roster and the scene. Players sent several of these in
 * the first live test (25 November 2026) — a player could deal, move the count,
 * shuffle or redraw the GM's hand — because only a few were checked.
 */
const GM_ONLY = new Set<CardTableCommand['type']>([
	'enemy-health',
	'reshuffle',
	'reset-table',
	'guided',
	'set-mode',
	'begin-round',
	'end-round',
	'mulligan',
	'set-count',
	'advance-count',
	'rewind-count',
	'minor-actions',
	'sweep',
	'add-opponent',
	'remove-opponent',
	'update-opponent',
	'set-scene-zones',
	'set-scene-picture',
	'clear-scene-picture',
	'clear-scene',
	'add-creatures',
	'remove-creature',
	'split-opponent',
	'merge-opponent'
]);

/**
 * Whose a command acts on, when it acts on one person: a facedown slot's
 * holder, or whoever is being placed in the scene. An enemy's id, or a
 * creature's, is nobody's seat, so only the GM passes.
 */
function ownedBy(command: CardTableCommand): string | null {
	switch (command.type) {
		case 'place-facedown':
		case 'reveal-facedown':
		case 'clear-facedown':
			return command.holder;
		case 'place':
			return command.who;
		default:
			return null;
	}
}

/** With nobody in the GM seat, anyone may run the table — the rule `reset-table` already follows. */
const isGm = (table: CardTable, actor: string | undefined): boolean =>
	!table.gmSeat || actor === table.gmSeat;
const state = (table: CardTable, kind: string, data: unknown): CardTableOutcome => ({
	ok: true,
	state: table,
	stateVersion: TABLE_SCHEMA_VERSION,
	kind,
	data
});

/** The deck definition out of the pack files the shell fetched for us. */
const deckOf = (pack: Record<string, unknown>): DeckDefinition =>
	pack['data/deck.json'] as DeckDefinition;

export const hmtwCardTable: CardTableModule = {
	packFiles: ['data/deck.json', 'data/challenge.json'],

	create(pack, rng) {
		// Shuffled here rather than in `createTable`, which stays pure and
		// ordered so tests can assert an exact deal. A table that opened in pack
		// order was the bug: the first hand dealt was the Ace, Two, Three of
		// Swords, which nobody noticed until somebody played on it.
		let table = createTable(deckOf(pack));
		table = reshuffleDeck(table, 'player', rng);
		table = reshuffleDeck(table, 'gm', rng);
		return { state: table, stateVersion: TABLE_SCHEMA_VERSION };
	},

	migrate(raw, pack) {
		// `foolCards` cannot be recovered from an old blob — the deck definition
		// was never in it — so the pack reseeds it on the way through.
		const migrated = withDeckFacts(migrateTable(raw as CardTable), deckOf(pack));
		return { state: migrated, stateVersion: TABLE_SCHEMA_VERSION };
	},

	/**
	 * Make the engine's seats match the shell's, which is the authority on who is
	 * sitting. A seat that has gone takes its zones with it; its cards go
	 * nowhere on their own, because where they land is a table decision.
	 */
	syncSeats(raw, seats) {
		let table = raw as CardTable;
		const wanted = new Set(seats.map((s) => s.id));

		for (const seat of table.seats) if (!wanted.has(seat)) table = removeSeat(table, seat);
		for (const seat of seats) table = addSeat(table, seat.id);

		const gm = seats.find((s) => s.isGm)?.id ?? null;
		return table.gmSeat === gm ? table : setGmSeat(table, gm);
	},

	reduce(raw, command, context) {
		const parsed = commandSchema.safeParse(command);
		if (!parsed.success) return fail('malformed-command');
		const table = raw as CardTable;
		const actor = context.actorSeatId ?? undefined;

		// Who may do what. Running the round and the roster is the GM's; your
		// own cards, facedown slot and place in the scene are yours and the
		// GM's. Card moves are checked by the engine's `mayReach`.
		if (GM_ONLY.has(parsed.data.type) && !isGm(table, actor)) return fail('gm-only');
		const holder = ownedBy(parsed.data);
		if (holder !== null && holder !== actor && !isGm(table, actor)) return fail('not-yours');
		// Enemy Health is anyone's to change while it is shown, so a player can
		// catch a miscount; while it is hidden, the players cannot see it to
		// change it, and it is the GM's.
		if (
			(parsed.data.type === 'set-hd' || parsed.data.type === 'set-down') &&
			table.enemyHealth === 'hidden' &&
			!isGm(table, actor)
		) {
			return fail('gm-only');
		}

		switch (parsed.data.type) {
			case 'move': {
				// A draw from an empty deck shuffles its discard back in first, as a
				// deal already does and as anyone at a physical table would. Without
				// it a Test of Fate from an empty deck simply failed, and only the GM
				// may shuffle.
				const fromDeck = parsed.data.from.zone.match(/^deck:(player|gm)$/)?.[1] as
					'player' | 'gm' | undefined;
				const refill =
					fromDeck !== undefined && (table.zones[parsed.data.from.zone]?.cards.length ?? 1) === 0;
				const source = refill && fromDeck ? reshuffleDeck(table, fromDeck, context.rng) : table;
				const moved = moveCard(source, parsed.data.from, parsed.data.to, actor);
				if (!moved.ok) return fail(moved.reason);
				// "When the Fool is drawn, shuffle both decks at the end of the
				// round." Drawn is drawn: turning it over onto a discard during a
				// Test of Fate counts, not only being dealt it in a Challenge.
				const drewFool =
					parsed.data.from.zone.startsWith('deck:') && table.foolCards.includes(moved.card);
				const next = drewFool
					? { ...moved.table, round: { ...moved.table.round, foolDrawn: true } }
					: moved.table;
				// Zones, never the card: the destination's own visibility decides
				// who gets to see what actually moved.
				return state(next, 'move', {
					from: parsed.data.from.zone,
					to: parsed.data.to,
					seat: context.actorSeatId,
					...(refill ? { reshuffled: true } : {})
				});
			}
			case 'set-mode': {
				// Not a rules judgement — a seat one. Leaving a Challenge sweeps
				// every hand on the table, so it belongs to whoever is running it.
				if (table.gmSeat && context.actorSeatId !== table.gmSeat) return fail('gm-only');
				return state(setMode(table, parsed.data.mode, context.rng), 'set-mode', {
					mode: parsed.data.mode,
					seat: context.actorSeatId
				});
			}
			case 'begin-round': {
				const next = beginRound(table, {
					playerHand: parsed.data.playerHand,
					gmHand: parsed.data.gmHand,
					rng: context.rng
				});
				// Counts, never cards: how many you drew is table knowledge, what
				// you drew is not.
				return state(next, 'begin-round', {
					round: next.round.number,
					playerHand: parsed.data.playerHand,
					gmHand: parsed.data.gmHand
				});
			}
			case 'end-round': {
				const next = endRound(table, context.rng);
				// Said when it happens, now that nobody else was told the Fool was out.
				return state(next, 'end-round', {
					round: table.round.number,
					shuffled: table.round.foolDrawn
				});
			}
			case 'mulligan': {
				return state(mulliganGmHand(table, context.rng), 'mulligan', {
					seat: context.actorSeatId
				});
			}
			case 'set-count':
				return state(setCount(table, parsed.data.count), 'count', { count: parsed.data.count });
			case 'advance-count': {
				const next = advanceCount(table);
				return state(next, 'count', { count: next.round.count });
			}
			case 'rewind-count': {
				const next = rewindCount(table);
				return state(next, 'count', { count: next.round.count });
			}
			case 'minor-actions':
				return state(setMinorActions(table, parsed.data.open), 'minor-actions', {
					open: parsed.data.open
				});
			case 'sweep': {
				// Ch.7's Sweep: what was played face up goes to the discard, and
				// facedown cards stay, because they have not happened yet.
				let next = table;
				for (const seat of table.seats) {
					const deck = seat === table.gmSeat ? 'gm' : 'player';
					next = discardAll(next, seatZone(seat, 'played'), deck);
				}
				for (const opponent of table.opponents) {
					next = discardAll(next, opponentZone(opponent.id, 'played'), 'gm');
				}
				// Sweeping is what you do once a number is over, so it settles the
				// number as closing minor actions does. Without this, sweeping instead
				// of closing held the end-of-round check back (first live test).
				if (next.round.count !== null && next.round.settled !== next.round.count) {
					next = setMinorActions(next, false);
				}
				return state(next, 'sweep', { seat: context.actorSeatId });
			}
			case 'add-opponent':
				return state(
					addOpponent(table, {
						id: parsed.data.id,
						name: parsed.data.name,
						count: parsed.data.count,
						health: parsed.data.health,
						defense: parsed.data.defense
					}),
					'add-opponent',
					{ name: parsed.data.name, count: parsed.data.count }
				);
			case 'remove-opponent':
				return state(removeOpponent(table, parsed.data.id), 'remove-opponent', {
					id: parsed.data.id
				});
			case 'update-opponent':
				return state(
					updateOpponent(table, parsed.data.id, { name: parsed.data.name }),
					'update-opponent',
					{ id: parsed.data.id }
				);
			case 'place-facedown': {
				const placed = placeFacedown(
					table,
					parsed.data.holder,
					parsed.data.from,
					{ position: parsed.data.position, label: parsed.data.label },
					actor
				);
				if (!placed.ok) return fail(placed.reason);
				// The declared action is public by ch.7's own rule; the value is not.
				return state(placed.table, 'place-facedown', {
					holder: parsed.data.holder,
					position: parsed.data.position,
					label: parsed.data.label
				});
			}
			case 'reveal-facedown': {
				const revealed = revealFacedown(table, parsed.data.holder);
				if (!revealed.ok) return fail(revealed.reason);
				return state(revealed.table, 'reveal-facedown', { holder: parsed.data.holder });
			}
			case 'clear-facedown':
				return state(clearFacedown(table, parsed.data.holder), 'clear-facedown', {
					holder: parsed.data.holder
				});
			case 'guided': {
				if (table.gmSeat && context.actorSeatId !== table.gmSeat) return fail('gm-only');
				return state({ ...table, guided: parsed.data.on }, 'guided', { on: parsed.data.on });
			}
			case 'clear-fate':
				return state(discardAll(table, FATE_ZONE, 'player'), 'clear-fate', {
					seat: context.actorSeatId
				});
			case 'set-scene-zones': {
				if (!isGm(table, actor)) return fail('gm-only');
				const next = setSceneZones(table, parsed.data.zones);
				return state(next, 'set-scene-zones', { zones: next.scene.zones.map((z) => z.name) });
			}
			case 'set-scene-picture':
				if (!isGm(table, actor)) return fail('gm-only');
				return state(
					setScenePicture(table, { id: parsed.data.id, mime: parsed.data.mime }),
					'set-scene-picture',
					{}
				);
			case 'clear-scene-picture':
				if (!isGm(table, actor)) return fail('gm-only');
				return state(setScenePicture(table, null), 'clear-scene-picture', {});
			case 'clear-scene':
				if (!isGm(table, actor)) return fail('gm-only');
				return state(clearScene(table), 'clear-scene', {});
			case 'place': {
				const { who, zone } = parsed.data;
				if (!placeable(table).has(who)) return fail('no-such-person');
				if (zone !== null && !table.scene.zones.some((z) => z.id === zone)) {
					return fail('no-such-zone');
				}
				const isSeat = table.seats.includes(who);
				return state(placeInScene(table, who, zone), 'place', {
					who,
					...(isSeat ? { seat: who } : { label: creatureLabel(table.opponents, who) }),
					zone: table.scene.zones.find((z) => z.id === zone)?.name ?? null
				});
			}
			case 'add-creatures': {
				const before = new Set(table.opponents.flatMap((o) => o.creatures.map((c) => c.id)));
				const hdGiven =
					parsed.data.health === undefined && parsed.data.defense === undefined
						? undefined
						: { health: parsed.data.health, defense: parsed.data.defense };
				const next = addCreatures(table, parsed.data.id, parsed.data.count, hdGiven);
				if (next === table) return fail('no-room');
				const added = next.opponents
					.flatMap((o) => o.creatures)
					.filter((c) => !before.has(c.id))
					.map((c) => creatureLabel(next.opponents, c.id));
				return state(next, 'add-creatures', { labels: added });
			}
			case 'remove-creature': {
				const label = creatureLabel(table.opponents, parsed.data.creature);
				const next = removeCreature(table, parsed.data.creature);
				if (next === table) return fail('no-such-creature');
				return state(next, 'remove-creature', { label });
			}
			case 'set-hd': {
				const { creature, pool, stat, from, to } = parsed.data;
				const changed = setHd(table, creature, { pool, stat, from, to });
				if (!changed.ok) return fail(changed.reason);
				const now = findCreature(changed.table, creature)?.creature.pools[pool];
				const label = creatureLabel(changed.table.opponents, creature);
				// Events are the public log. While Health is hidden the change is
				// logged without its numbers; the GM reads them off the table.
				return state(
					changed.table,
					'set-hd',
					table.enemyHealth === 'hidden'
						? { label, creature, stat }
						: {
								label,
								creature,
								stat,
								value: now?.[stat] ?? to,
								max: stat === 'health' ? now?.healthMax : now?.defenseMax
							}
				);
			}
			case 'enemy-health': {
				const enemyHealth = parsed.data.shown ? 'shown' : 'hidden';
				return state({ ...table, enemyHealth }, 'enemy-health', { shown: parsed.data.shown });
			}
			case 'set-down': {
				const next = setDown(table, parsed.data.creature, parsed.data.down);
				if (!findCreature(table, parsed.data.creature)) return fail('no-such-creature');
				return state(next, 'set-down', {
					label: creatureLabel(table.opponents, parsed.data.creature),
					down: parsed.data.down
				});
			}
			case 'split-opponent': {
				if (!isGm(table, actor)) return fail('gm-only');
				const next = splitOpponent(table, parsed.data.id, {
					id: parsed.data.newId,
					name: parsed.data.name,
					creatures: parsed.data.creatures
				});
				if (next === table) return fail('cannot-split');
				return state(next, 'split-opponent', {
					labels: parsed.data.creatures.map((c) => creatureLabel(next.opponents, c))
				});
			}
			case 'merge-opponent': {
				if (!isGm(table, actor)) return fail('gm-only');
				const { id } = parsed.data;
				const name = table.opponents.find((o) => o.id === id)?.name;
				const next = mergeOpponent(table, id);
				if (next === table) return fail('cannot-merge');
				return state(next, 'merge-opponent', { name });
			}
			case 'reset-table': {
				if (table.gmSeat && context.actorSeatId !== table.gmSeat) return fail('gm-only');
				// Back to a table nobody has played on: every card home, both decks
				// shuffled, no enemies, no round. Inspiration goes too — this is
				// the button for starting again, not for ending a fight.
				let next = setMode(table, 'decks', context.rng);
				for (const seat of next.seats) {
					const deck = seat === next.gmSeat ? 'gm' : 'player';
					for (const kind of ['hand', 'initiative', 'played', 'facedown', 'durable'] as const) {
						next = discardAll(next, seatZone(seat, kind), deck);
					}
				}
				next = discardAll(next, FATE_ZONE, 'player');
				next = reshuffleDeck(next, 'player', context.rng);
				next = reshuffleDeck(next, 'gm', context.rng);
				next = clearScene(next);
				return state(next, 'reset-table', { seat: context.actorSeatId });
			}
			case 'reshuffle': {
				// The seed stays here. A shuffle's event carries no payload at all,
				// because anything derived from the order is the order.
				const next = reshuffleDeck(table, parsed.data.deck, context.rng);
				return state(next, 'reshuffle', {
					deck: parsed.data.deck,
					seat: context.actorSeatId
				});
			}
		}
	},

	project(raw, viewer) {
		return projectFor(raw as CardTable, viewer ?? undefined);
	},

	pictureOf(raw) {
		return (raw as CardTable).scene?.picture?.id ?? null;
	}
};
