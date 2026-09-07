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
	addSeat,
	createTable,
	migrateTable,
	moveCard,
	projectFor,
	removeSeat,
	reshuffleDeck,
	setGmSeat,
	withFoolCards,
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
	z.strictObject({ type: z.literal('reshuffle'), deck: z.enum(['player', 'gm']) })
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

	create(pack) {
		return { state: createTable(deckOf(pack)), stateVersion: TABLE_SCHEMA_VERSION };
	},

	migrate(raw, pack) {
		// `foolCards` cannot be recovered from an old blob — the deck definition
		// was never in it — so the pack reseeds it on the way through.
		const migrated = withFoolCards(migrateTable(raw as CardTable), deckOf(pack));
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
				// Zones, never the card: the destination's own visibility decides
				// who gets to see what actually moved.
				return state(moved.table, 'move', {
					from: parsed.data.from.zone,
					to: parsed.data.to,
					seat: context.actorSeatId
				});
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
