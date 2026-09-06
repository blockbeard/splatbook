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
 * card is already public. "Flip whatever is in seat 3's initiative slot" is
 * something any seat may send and the server resolves; "move the Ace of Cups out
 * of seat 3's hand" is not a request the wire will carry, because being able to
 * ask it means already knowing the answer. The discard is the one place naming
 * a card is both legal and necessary — that is where a High Chant's inspiration
 * cards are chosen from.
 *
 * **Flipping is moving.** A card's face is visible because of the zone it is in,
 * so revealing a facedown card is a move to a public zone and turning the top of
 * a deck into the discard is the same operation. There is no `flip` verb.
 */

import type { CardTable } from './table';
import { shuffle, type Rng } from './shuffle';
import { deckZone, discardZone, type DeckId } from './zones';

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
	| 'card-named-in-private-zone';

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
export function moveCard(table: CardTable, from: Pick, to: string): MoveResult {
	const source = table.zones[from.zone];
	const target = table.zones[to];
	if (!source || !target) return fail('no-such-zone');

	let index = 0;
	if (from.card !== undefined) {
		if (source.visibility !== 'public') return fail('card-named-in-private-zone');
		index = source.cards.indexOf(from.card);
		if (index === -1) return fail('no-such-card');
	} else if (source.cards.length === 0) {
		return fail('empty');
	}

	const card = source.cards[index];
	if (card === undefined) return fail('empty');
	if (target.capacity !== null && target.cards.length >= target.capacity) return fail('full');

	const remaining = source.cards.filter((_, i) => i !== index);
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
