/**
 * The round: drawing, the count, the minor-action window, and the end of it.
 *
 * Ch.7's five steps, as state rather than as a procedure. Nothing here runs the
 * round — the table is permissive and the people at it have the book open — but
 * the round *has* a shape, and that shape is what a prompter later reads and
 * what an end-of-round tidy-up acts on.
 *
 * Pure: the caller supplies the seeded generator, so the deck order stays on the
 * server.
 */

import { deal, discardAll, reshuffleDeck, type DealResult } from './moves';
import type { CardTable } from './table';
import { seededRng, type Rng } from './shuffle';
import { deckZone, seatZone, opponentZone, type DeckId } from './zones';

/**
 * Where the round has got to (phase 32). The first live test (25 November
 * 2026) ran the round by hand — a count stepper, a minor-action window, a
 * Sweep — and nobody could tell what was going on. The round now runs as the
 * book's steps, and each step that happens by itself happens inside the command
 * that completes it: the last initiative card starts the count, the last answer
 * to minor actions turns the cards over. The GM can always move it on.
 *
 * - `deal`: nobody has drawn this round.
 * - `initiative`: everyone is choosing an initiative card.
 * - `turn`: the count is on a number, and whoever holds it is acting.
 * - `minor`: everyone else is putting down a minor action or passing.
 * - `resolve`: the number's cards are face up; the GM applies them and moves on.
 * - `over`: everyone has acted; the end-of-round check.
 */
export type RoundStep = 'deal' | 'initiative' | 'turn' | 'minor' | 'resolve' | 'over';

export interface Round {
	/** 0 before the first round of a Challenge. */
	number: number;
	/**
	 * The initiative number being acted on, or `null` before the count starts.
	 *
	 * Not capped at the king: the GM plays initiative from the majors, so an
	 * enemy can sit at a greater doom's 17 and must still get its turn.
	 */
	count: number | null;
	/**
	 * Set when the Fool comes out of the deck this round. "When the Fool is
	 * drawn, shuffle both the minor and major arcana decks at the end of the
	 * round" — so this is remembered at the draw and spent at the end.
	 */
	foolDrawn: boolean;
	step: RoundStep;
	/**
	 * Who has had their turn this round — per round, not per number, so Guard's
	 * new initiative card cannot give anyone a second one.
	 */
	acted: string[];
	/** Who has put down a minor action, readied one, or passed, at this number. */
	answered: string[];
	/**
	 * Whose initiative card is face up. A card cannot be moved out of its slot
	 * to turn it over, because the count reads it there; so the slot is shown to
	 * everyone instead. Its holder's number coming up, being named as a target,
	 * or "Show my initiative" adds to it; the end of the round clears it.
	 */
	shown: string[];
	/**
	 * Whether a card was played at this number. "If you do not take an action
	 * … Nobody takes minor actions", so a number where everyone skipped opens no
	 * minor actions.
	 */
	playedHere: boolean;
}

export const newRound = (): Round => ({
	number: 0,
	count: null,
	foolDrawn: false,
	step: 'deal',
	acted: [],
	answered: [],
	shown: [],
	playedHere: false
});

/** What the GM's draw is built from — `data/challenge.json`'s `handSizes.gm`, structurally. */
export interface GmHandConfig {
	base: number;
	modifiers: readonly { id: string; amount: number; kind: 'toggle' | 'count' }[];
}

/**
 * The GM's draw for this round: a base plus the cumulative reasons that apply.
 *
 * A *suggestion*. Ch.7's list is checked afresh each round — "if the number of
 * enemies decreases, you will draw fewer" — and this computes what the ticked
 * boxes come to. It has no authority: `beginRound` takes the number the GM
 * actually wants, which is usually this one and sometimes not.
 *
 * `toggle` modifiers count once when true; `count` modifiers once per instance,
 * which is how "+1 card for each type of enemy" and "+1 for each enemy larger
 * than a human" work.
 */
export function suggestGmHandSize(
	config: GmHandConfig,
	selections: Readonly<Record<string, boolean | number>>
): number {
	let total = config.base;
	for (const modifier of config.modifiers) {
		const picked = selections[modifier.id];
		if (picked === undefined || picked === false) continue;
		const times = modifier.kind === 'count' ? Math.max(0, Math.floor(Number(picked) || 0)) : 1;
		total += modifier.amount * times;
	}
	// A house rule can take a card off; it can never make the draw negative.
	return Math.max(0, total);
}

/**
 * Deal, reshuffling the discard back in if the pile runs dry mid-hand.
 *
 * The book does not cover a deck running out mid-deal, because at a physical
 * table you shuffle the discard and carry on without anyone calling it a rule.
 * This does the same.
 */
function dealRefilling(
	table: CardTable,
	deck: DeckId,
	to: string,
	count: number,
	rng: Rng
): DealResult {
	const first = deal(table, deckZone(deck), to, count);
	if (!first.ok || first.cards.length === count) return first;

	const remaining = count - first.cards.length;
	const refilled = reshuffleDeck(first.table, deck, rng);
	const second = deal(refilled, deckZone(deck), to, remaining);
	if (!second.ok) return second;
	return { ok: true, table: second.table, cards: [...first.cards, ...second.cards] };
}

export interface BeginRoundOptions {
	/** Cards per player. Four, per ch.7, unless the table says otherwise. */
	playerHand: number;
	/** Cards for the GM — `suggestGmHandSize`, or whatever the GM decided instead. */
	gmHand: number;
	/** Seeded; the seed stays on the server. */
	rng: Rng;
}

/**
 * Start a round: bump the number, deal to every seat, and note whether the Fool
 * came out.
 *
 * The GM's seat draws from the majors and everyone else from the minors, which
 * is the only place the engine cares who the GM is. A table with no GM seated
 * simply deals to the players.
 */
export function beginRound(table: CardTable, opts: BeginRoundOptions): CardTable {
	let current = table;
	let drew: string[] = [];

	for (const seat of table.seats) {
		const isGm = seat === table.gmSeat;
		const size = isGm ? opts.gmHand : opts.playerHand;
		if (size <= 0) continue;
		const result = dealRefilling(
			current,
			isGm ? 'gm' : 'player',
			seatZone(seat, 'hand'),
			size,
			opts.rng
		);
		if (!result.ok) continue;
		current = result.table;
		drew = [...drew, ...result.cards];
	}

	const fool = drew.some((card) => current.foolCards.includes(card));
	return {
		...current,
		round: {
			...newRound(),
			number: table.round.number + 1,
			step: 'initiative',
			// The Fool may already have been drawn earlier in the same round by a
			// refill; never clear a flag that is waiting to be spent.
			foolDrawn: table.round.foolDrawn || fool
		}
	};
}

/**
 * Discard the GM's hand and draw the same number again.
 *
 * Ch.7 lets the GM mulligan a hand that is "*mostly* greater dooms" and gives no
 * threshold, so there is nothing here to test for — this is the button, and
 * pressing it is the GM's judgement.
 */
export function mulliganGmHand(table: CardTable, rng: Rng): CardTable {
	if (!table.gmSeat) return table;
	const hand = table.zones[seatZone(table.gmSeat, 'hand')];
	if (!hand || hand.cards.length === 0) return table;

	const size = hand.cards.length;
	const cleared = discardAll(table, hand.id, 'gm');
	const result = dealRefilling(cleared, 'gm', hand.id, size, rng);
	if (!result.ok) return cleared;
	const fool = result.cards.some((card) => table.foolCards.includes(card));
	return {
		...result.table,
		round: { ...result.table.round, foolDrawn: result.table.round.foolDrawn || fool }
	};
}

/**
 * End the round, per ch.7 step 5.
 *
 * "Everybody discards any unused Challenge cards in their hand. Everybody
 * discards their current Initiative card. **Facedown cards remain in play.** If
 * the Fool was drawn during this past round, both minor and major arcana decks
 * are shuffled."
 *
 * That third sentence is the one an earlier draft of this phase had wrong, and
 * it is the reason a sweep here cannot simply clear the table: a readied Dodge
 * survives into the next round and is a large part of what facedown actions are
 * for.
 */
export function endRound(table: CardTable, rng: Rng): CardTable {
	let current = table;

	// Hands and initiative, as the book says; and anything still lying played
	// or put down as a minor action, which a round ended early can leave behind.
	for (const seat of table.seats) {
		const deck: DeckId = seat === table.gmSeat ? 'gm' : 'player';
		for (const kind of ['hand', 'initiative', 'played', 'minor'] as const) {
			current = discardAll(current, seatZone(seat, kind), deck);
		}
	}
	for (const opponent of table.opponents) {
		for (const kind of ['initiative', 'played', 'minor'] as const) {
			current = discardAll(current, opponentZone(opponent.id, kind), 'gm');
		}
	}

	if (current.round.foolDrawn) {
		current = reshuffleDeck(current, 'player', rng);
		current = reshuffleDeck(current, 'gm', rng);
	}

	return {
		...current,
		plays: {},
		minorDeclared: {},
		minorTargets: {},
		round: { ...newRound(), number: current.round.number }
	};
}

/** Convenience for callers that have a seed rather than a generator. */
export const rngFromSeed = (seed: number): Rng => seededRng(seed);
