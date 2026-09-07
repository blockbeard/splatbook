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

import { deal, emptyInto, reshuffleDeck, type DealResult } from './moves';
import type { CardTable } from './table';
import { seededRng, type Rng } from './shuffle';
import { deckZone, discardZone, seatZone, opponentZone, type DeckId } from './zones';

export interface Round {
	/** 0 before the first round of a Challenge. */
	number: number;
	/**
	 * The initiative currently being called, or `null` when nobody is counting.
	 *
	 * Not capped at the king. Ch.7 tells the GM to count "from lowest card (I)
	 * through the highest card (king)", which is the *players'* range — they hold
	 * minors. The GM plays initiative from the majors, so an enemy can sit at a
	 * greater doom's 17 and must still get its turn. The count is a number that
	 * goes up; when it stops is the table's business.
	 */
	count: number | null;
	/** Whether the window after a turn is open, when anyone may declare a minor action. */
	minorActions: boolean;
	/**
	 * Set when the Fool comes out of the deck this round. "When the Fool is
	 * drawn, shuffle both the minor and major arcana decks at the end of the
	 * round" — so this is remembered at the draw and spent at the end.
	 */
	foolDrawn: boolean;
	/**
	 * Who is acting out of turn, if anyone. Interrupts "take place *before* the
	 * acting player's action", so the count waits rather than moving on.
	 */
	interrupt: string | null;
	/**
	 * Who is owed a second turn by the Fool. The book grants the turn but no
	 * minor actions with it; spent when they take it.
	 */
	extraTurn: string | null;
	/**
	 * The initiative number whose turn and minor actions are finished.
	 *
	 * Without it the guide loops: the count still matches whoever just acted, so
	 * it goes on saying "four — Daria, that is you" at somebody who has had
	 * their turn and is waiting for the count to move. Closing the minor-action
	 * window is the moment a number is done, so that is where this is set;
	 * moving the count clears it.
	 */
	settled: number | null;
}

export const newRound = (): Round => ({
	number: 0,
	count: null,
	minorActions: false,
	foolDrawn: false,
	interrupt: null,
	extraTurn: null,
	settled: null
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
	return total;
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
			number: table.round.number + 1,
			count: null,
			minorActions: false,
			interrupt: null,
			extraTurn: null,
			settled: null,
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
	const cleared = emptyInto(table, hand.id, discardZone('gm'));
	const result = dealRefilling(cleared, 'gm', hand.id, size, rng);
	if (!result.ok) return cleared;
	const fool = result.cards.some((card) => table.foolCards.includes(card));
	return {
		...result.table,
		round: { ...result.table.round, foolDrawn: result.table.round.foolDrawn || fool }
	};
}

/** Call an initiative number. `null` stops counting. */
export function setCount(table: CardTable, count: number | null): CardTable {
	// Moving the count un-settles it: the new number has had no turn yet.
	return { ...table, round: { ...table.round, count, settled: null } };
}

/** The next number up. Starts at 1 — the ace — when nobody is counting yet. */
export function advanceCount(table: CardTable): CardTable {
	return setCount(table, (table.round.count ?? 0) + 1);
}

/** Back one, for the GM who called a number too soon. Never below the ace. */
export function rewindCount(table: CardTable): CardTable {
	if (table.round.count === null) return table;
	return setCount(table, Math.max(1, table.round.count - 1));
}

/**
 * Open or close the window in which anyone may declare a minor action.
 *
 * Closing it settles the number being called: the turn happened, the minor
 * actions were revealed, and there is nothing else owed on it.
 */
export function setMinorActions(table: CardTable, open: boolean): CardTable {
	return {
		...table,
		round: {
			...table.round,
			minorActions: open,
			settled: open ? table.round.settled : table.round.count
		}
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

	for (const seat of table.seats) {
		const deck: DeckId = seat === table.gmSeat ? 'gm' : 'player';
		current = emptyInto(current, seatZone(seat, 'hand'), discardZone(deck));
		current = emptyInto(current, seatZone(seat, 'initiative'), discardZone(deck));
	}
	for (const opponent of table.opponents) {
		current = emptyInto(current, opponentZone(opponent.id, 'initiative'), discardZone('gm'));
	}

	if (current.round.foolDrawn) {
		current = reshuffleDeck(current, 'player', rng);
		current = reshuffleDeck(current, 'gm', rng);
	}

	return {
		...current,
		round: {
			...current.round,
			count: null,
			minorActions: false,
			foolDrawn: false,
			interrupt: null,
			extraTurn: null,
			settled: null
		}
	};
}

/** Convenience for callers that have a seed rather than a generator. */
export const rngFromSeed = (seed: number): Rng => seededRng(seed);
