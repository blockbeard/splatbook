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
	TABLE_SCHEMA_VERSION,
	FATE_ZONE,
	addOpponent,
	addSeat,
	advanceCount,
	beginRound,
	clearFacedown,
	createTable,
	discardZone,
	emptyInto,
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
		count: z.number().int().min(1).max(999)
	}),
	z.strictObject({ type: z.literal('remove-opponent'), id: z.string().min(1).max(60) }),
	z.strictObject({
		type: z.literal('update-opponent'),
		id: z.string().min(1).max(60),
		name: z.string().min(1).max(60).optional(),
		count: z.number().int().min(1).max(999).optional()
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
	z.strictObject({ type: z.literal('clear-facedown'), holder: z.string().min(1).max(60) })
]);

export type CardTableCommand = z.infer<typeof commandSchema>;

const fail = (reason: string): CardTableOutcome => ({ ok: false, reason });
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

		switch (parsed.data.type) {
			case 'move': {
				const moved = moveCard(table, parsed.data.from, parsed.data.to, actor);
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
					seat: context.actorSeatId
				});
			}
			case 'set-mode': {
				// Not a rules judgement — a seat one. Leaving a Challenge sweeps
				// every hand on the table, so it belongs to whoever is running it.
				if (table.gmSeat && context.actorSeatId !== table.gmSeat) return fail('gm-only');
				return state(setMode(table, parsed.data.mode), 'set-mode', {
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
				return state(next, 'end-round', { round: table.round.number });
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
					next = emptyInto(next, seatZone(seat, 'played'), discardZone(deck));
				}
				for (const opponent of table.opponents) {
					next = emptyInto(next, opponentZone(opponent.id, 'played'), discardZone('gm'));
				}
				return state(next, 'sweep', { seat: context.actorSeatId });
			}
			case 'add-opponent':
				return state(
					addOpponent(table, {
						id: parsed.data.id,
						name: parsed.data.name,
						count: parsed.data.count
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
					updateOpponent(table, parsed.data.id, {
						name: parsed.data.name,
						count: parsed.data.count
					}),
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
				return state(emptyInto(table, FATE_ZONE, discardZone('player')), 'clear-fate', {
					seat: context.actorSeatId
				});
			case 'reset-table': {
				if (table.gmSeat && context.actorSeatId !== table.gmSeat) return fail('gm-only');
				// Back to a table nobody has played on: every card home, both decks
				// shuffled, no enemies, no round. Inspiration goes too — this is
				// the button for starting again, not for ending a fight.
				let next = setMode(table, 'decks');
				for (const seat of next.seats) {
					const deck = seat === next.gmSeat ? 'gm' : 'player';
					for (const kind of ['hand', 'initiative', 'played', 'facedown', 'durable'] as const) {
						next = emptyInto(next, seatZone(seat, kind), discardZone(deck));
					}
				}
				next = emptyInto(next, FATE_ZONE, discardZone('player'));
				next = reshuffleDeck(next, 'player', context.rng);
				next = reshuffleDeck(next, 'gm', context.rng);
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
	}
};
