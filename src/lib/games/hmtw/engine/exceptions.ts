/**
 * The rules that change what a slot is or what a turn can be.
 *
 * Ch.7's five steps are the easy part; these are the parts with structural
 * consequences, and every one of them was missed by a plan that read a rival
 * app's interface instead of the chapter.
 *
 * Still permissive: none of this refuses a play. A facedown slot holds one card
 * because the book says so and because a second has nowhere to go — which is
 * not the same as being told no.
 */

import { moveCard, type MoveFailure } from './moves';
import type { CardTable } from './table';
import { discardZone, opponentZone, seatZone } from './zones';

/**
 * Where a facedown card sits relative to the initiative card, which is not
 * decoration — it is what the card is worth when it turns over.
 *
 * "If you play a card facedown on your turn, set the facedown card sideways
 * *above* your Initiative card. When the time comes to reveal the card, add the
 * appropriate attribute" — versus below it, played as a minor action, where
 * "use the face value of the card for the total".
 */
export type FacedownPosition = 'turn' | 'minor';

export interface FacedownAction {
	position: FacedownPosition;
	/**
	 * The declared action — "Riposte", "Dodge" — and it is **public**.
	 *
	 * Not a convenience: ch.7's "No peeking!" sidebar has the player "state what
	 * action they are taking" while "only they know the card's value". So intent
	 * is table knowledge and the number is not, and this label is the half that
	 * everyone gets.
	 */
	label: string;
}

/** The facedown zone belonging to a seat or an opponent. */
export function facedownZoneOf(table: CardTable, holder: string): string | null {
	if (table.seats.includes(holder)) return seatZone(holder, 'facedown');
	if (table.opponents.some((o) => o.id === holder)) return opponentZone(holder, 'facedown');
	return null;
}

/** Which discard a holder's cards belong in. */
function discardFor(table: CardTable, holder: string): string {
	const isPlayer = table.seats.includes(holder) && holder !== table.gmSeat;
	return discardZone(isPlayer ? 'player' : 'gm');
}

export type ExceptionResult =
	{ ok: true; table: CardTable } | { ok: false; reason: MoveFailure | 'no-such-holder' };

/**
 * Place a card facedown, declaring what it is for.
 *
 * "You may only have one facedown action at a time. (Your Initiative card does
 * not count towards this limit!) If you take an action that would cause you to
 * place another card facedown, replace the current facedown card and discard the
 * last one." So this replaces rather than refuses — the limit is the book's, and
 * the table's answer to exceeding it is to discard the old one, not to say no.
 */
export function placeFacedown(
	table: CardTable,
	holder: string,
	from: { zone: string; card?: string },
	action: FacedownAction,
	actor?: string
): ExceptionResult {
	const zone = facedownZoneOf(table, holder);
	if (!zone) return { ok: false, reason: 'no-such-holder' };

	// Clear the old one first, so the slot's capacity of one is never the thing
	// that fails: replacing is the rule, not an error.
	const cleared = table.zones[zone].cards.length > 0 ? clearFacedown(table, holder) : table;

	const moved = moveCard(cleared, from, zone, actor);
	if (!moved.ok) return { ok: false, reason: moved.reason };
	return {
		ok: true,
		table: { ...moved.table, facedown: { ...moved.table.facedown, [zone]: action } }
	};
}

/**
 * Discard a facedown card without playing it — "If you no longer want to take
 * the facedown action, discard the card."
 */
export function clearFacedown(table: CardTable, holder: string): CardTable {
	const zone = facedownZoneOf(table, holder);
	if (!zone) return table;
	const moved = moveCard(table, { zone }, discardFor(table, holder));
	const next = moved.ok ? moved.table : table;
	const facedown = { ...next.facedown };
	delete facedown[zone];
	return { ...next, facedown };
}

/**
 * Turn a facedown card face up, into the holder's played pile. Its declared
 * action was already public; now the value is too.
 */
export function revealFacedown(table: CardTable, holder: string): ExceptionResult {
	const zone = facedownZoneOf(table, holder);
	if (!zone) return { ok: false, reason: 'no-such-holder' };
	const played = table.seats.includes(holder)
		? seatZone(holder, 'played')
		: opponentZone(holder, 'played');

	const moved = moveCard(table, { zone }, played);
	if (!moved.ok) return { ok: false, reason: moved.reason };
	const facedown = { ...moved.table.facedown };
	delete facedown[zone];
	return { ok: true, table: { ...moved.table, facedown } };
}

/**
 * Play the Fool, which is never played alone.
 *
 * "The Fool has a value of 0 and is always played in conjunction with another
 * card. When you play the Fool, you get an additional turn… this counts as an
 * interrupt action. The Fool *always* goes first, no matter what." And:
 * "drawing the Fool allows you to take two turns (but no minor actions) during
 * a round."
 *
 * Both cards go down together, which is why this is not two calls: a table that
 * showed the Fool land and then its partner a moment later would be showing
 * something the rules do not contain.
 */
export function playFool(
	table: CardTable,
	seat: string,
	fool: string,
	partner: string,
	actor?: string
): ExceptionResult {
	if (!table.seats.includes(seat)) return { ok: false, reason: 'no-such-holder' };
	const hand = seatZone(seat, 'hand');
	const played = seatZone(seat, 'played');

	const first = moveCard(table, { zone: hand, card: fool }, played, actor);
	if (!first.ok) return { ok: false, reason: first.reason };
	const second = moveCard(first.table, { zone: hand, card: partner }, played, actor);
	if (!second.ok) return { ok: false, reason: second.reason };

	return {
		ok: true,
		table: {
			...second.table,
			round: {
				...second.table.round,
				// It goes first regardless of the count, and it owes its player a
				// second turn on which no minor actions follow.
				interrupt: seat,
				extraTurn: seat,
				minorActions: false
			}
		}
	};
}

/**
 * Mark that someone is acting out of turn.
 *
 * "Some talents or circumstances can turn an action into an interrupt. Interrupt
 * actions take place *before* the acting player's action" and "do not count
 * against the limit of one action per turn." General, not a Fool special case —
 * a halfling with a polearm ripostes the charging goblin before its Attack
 * resolves.
 *
 * The play itself needs nothing new: the table already lets any seat move a card
 * at any time. This only records *that* it is happening, so a prompter can show
 * it and the count does not wander on.
 */
export const beginInterrupt = (table: CardTable, holder: string): CardTable => ({
	...table,
	round: { ...table.round, interrupt: holder }
});

export const endInterrupt = (table: CardTable): CardTable => ({
	...table,
	round: { ...table.round, interrupt: null }
});

/** Spend the extra turn the Fool granted. */
export const clearExtraTurn = (table: CardTable): CardTable => ({
	...table,
	round: { ...table.round, extraTurn: null }
});

/**
 * Skip a turn, which is a branch rather than an absence.
 *
 * "You do not *have* to take an action on your turn. If you do not take an
 * action, the GM continues counting. **Nobody takes minor actions**." Same when
 * a hand is empty as the number is called. So skipping does not merely fail to
 * open the minor-action window — it closes it.
 *
 * Cardless turns need nothing beyond this: a free action, or an ambush's
 * automatically-successful opening move, is a turn on which no card moved, and
 * the table has never required one to.
 */
export const skipTurn = (table: CardTable): CardTable => ({
	...table,
	round: { ...table.round, minorActions: false }
});
