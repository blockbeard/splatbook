/**
 * Moving cards. The whole vocabulary of the table is here, and it is short.
 *
 * **What this module refuses, and what it does not.** It refuses the
 * *impossible* (no such zone, no such card, a pile with nothing on top) and the
 * *unsafe* (naming a card in a zone whose faces you are not entitled to see).
 * It never refuses the merely illegal. Playing a Cups card for a Swords action,
 * taking two turns, moving a card out of turn — the engine has no opinion, by
 * design: this is a card table for people with the book open, not a referee.
 * If a refusal here ever encodes a rule, the phase has gone wrong.
 *
 * **Addressing.** A command names a *slot*, and may name a *card* only where the
 * asker is entitled to see that card's face. Anyone may name a card in the
 * discard — that is where a High Chant's inspiration cards are chosen from. You
 * may name a card in your own hand, because you are holding it. Nobody may name
 * one in a hidden pile or in someone else's hand, because being able to ask
 * means already knowing the answer.
 *
 * The `actor` argument is what makes that distinction possible, and it is
 * optional: omitted, only public zones can be named. That default is the safe
 * one for a server-internal call with nobody to speak for.
 *
 * **Flipping is moving.** A card's face is visible because of the zone it is in,
 * so revealing a facedown card is a move to a public zone and turning the top of
 * a deck into the discard is the same operation. There is no `flip` verb.
 */

import type { CardTable } from './table';
import { shuffle, type Rng } from './shuffle';
import { deckZone, discardZone, type DeckId, type Zone } from './zones';

/**
 * Where a card is coming from. `card` picks a specific one and is only accepted
 * for a `public` zone; without it the top of the pile moves.
 */
export interface Pick {
	zone: string;
	card?: string;
}

export type MoveFailure =
	| 'no-such-zone'
	| 'no-such-card'
	| 'empty'
	| 'full'
	/** A card was named in a zone whose faces the asker cannot see. Refused
	 * because the request itself leaks: you cannot name what you cannot read. */
	| 'card-named-in-private-zone'
	/** Someone tried to take a card out of a hand that is not theirs. */
	| 'not-your-hand';

/**
 * Whether `actor` may read the faces in a zone — and therefore whether they may
 * name a card in it.
 *
 * This is the engine's one privacy invariant, kept here rather than in the
 * command layer so that it cannot be forgotten by a caller. A `gm` zone
 * resolves against the table's current GM seat, which is why the seat is a
 * pointer.
 */
export function canTakeFrom(zone: Zone, actor?: string): boolean {
	// No actor means the server itself — an end-of-round sweep has no asker to
	// vouch for and must still be able to clear every hand.
	if (zone.reach === 'table' || actor === undefined) return true;
	return actor === zone.owner;
}

export function canSeeFaces(table: CardTable, zone: Zone, actor?: string): boolean {
	switch (zone.visibility) {
		case 'public':
			return true;
		case 'owner':
			return actor !== undefined && actor === zone.owner;
		case 'gm':
			return actor !== undefined && actor === table.gmSeat;
		case 'hidden':
			return false;
	}
}

export type MoveResult =
	{ ok: true; table: CardTable; card: string } | { ok: false; reason: MoveFailure };

const fail = (reason: MoveFailure): MoveResult => ({ ok: false, reason });

/**
 * Move one card from one zone to another. The atom every other operation is
 * built from.
 *
 * A card arrives on top of its destination, which is what a physical table does:
 * flip a card onto a discard and it is the one you see.
 */
export function moveCard(table: CardTable, from: Pick, to: string, actor?: string): MoveResult {
	const source = table.zones[from.zone];
	const target = table.zones[to];
	if (!source || !target) return fail('no-such-zone');

	if (!canTakeFrom(source, actor)) return fail('not-your-hand');

	let index = 0;
	if (from.card !== undefined) {
		if (!canSeeFaces(table, source, actor)) return fail('card-named-in-private-zone');
		index = source.cards.indexOf(from.card);
		if (index === -1) return fail('no-such-card');
	} else if (source.cards.length === 0) {
		return fail('empty');
	}

	const card = source.cards[index];
	if (card === undefined) return fail('empty');

	const remaining = source.cards.filter((_, i) => i !== index);

	// Same zone in and out: a reorder, bringing a card to the top of its own
	// pile. Handled before the general case because the two assignments below
	// collide on one key when the ids match and would duplicate the card. Cards
	// must be conserved, and this is the one path where that could go wrong.
	if (source.id === target.id) {
		return {
			ok: true,
			card,
			table: {
				...table,
				zones: { ...table.zones, [source.id]: { ...source, cards: [card, ...remaining] } }
			}
		};
	}

	if (target.capacity !== null && target.cards.length >= target.capacity) return fail('full');
	return {
		ok: true,
		card,
		table: {
			...table,
			zones: {
				...table.zones,
				[source.id]: { ...source, cards: remaining },
				[target.id]: { ...target, cards: [card, ...target.cards] }
			}
		}
	};
}

export type DealResult =
	{ ok: true; table: CardTable; cards: string[] } | { ok: false; reason: MoveFailure };

/**
 * Move `count` cards from the top of one zone to another — a deal, or a draw.
 *
 * Stops short rather than failing if the source runs dry: a deck that empties
 * mid-deal has given what it had, and the caller decides whether to reshuffle
 * and continue. All-or-nothing would be worse at a real table, where the
 * physical answer is "that's all of them, hang on".
 */
export function deal(table: CardTable, from: string, to: string, count: number): DealResult {
	if (!table.zones[from] || !table.zones[to]) return { ok: false, reason: 'no-such-zone' };
	let current = table;
	const cards: string[] = [];
	for (let i = 0; i < count; i++) {
		const step = moveCard(current, { zone: from }, to);
		if (!step.ok) {
			if (step.reason === 'empty') break;
			return { ok: false, reason: step.reason };
		}
		current = step.table;
		cards.push(step.card);
	}
	return { ok: true, table: current, cards };
}

/**
 * Shuffle a deck's discard back under it, and shuffle the whole pile.
 *
 * This is both the GM's button and what happens on its own when a draw pile
 * empties. The `rng` is seeded by the caller and the seed stays on the server —
 * see `shuffle.ts`. Nothing about the resulting order may reach a client.
 */
export function reshuffleDeck(table: CardTable, deck: DeckId, rng: Rng): CardTable {
	const draw = table.zones[deckZone(deck)];
	const discard = table.zones[discardZone(deck)];
	if (!draw || !discard) return table;
	return {
		...table,
		zones: {
			...table.zones,
			[draw.id]: { ...draw, cards: shuffle([...draw.cards, ...discard.cards], rng) },
			[discard.id]: { ...discard, cards: [] }
		}
	};
}

/** Move every card out of a zone into another, top-first. Used by sweeps and cleanups. */
export function emptyInto(table: CardTable, from: string, to: string): CardTable {
	const source = table.zones[from];
	if (!source) return table;
	const result = deal(table, from, to, source.cards.length);
	return result.ok ? result.table : table;
}
