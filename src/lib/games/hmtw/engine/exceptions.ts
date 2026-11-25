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

import { discardAll, moveCard, type MoveFailure } from './moves';
import type { CardTable } from './table';
import { opponentZone, seatZone, type DeckId } from './zones';

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

/**
 * Whose deck a holder's cards are *usually* from — only the fallback for a
 * card the table has no `deckOf` record of. The card's own deck decides.
 */
function usualDeck(table: CardTable, holder: string): DeckId {
	return table.seats.includes(holder) && holder !== table.gmSeat ? 'player' : 'gm';
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
	const next = discardAll(table, zone, usualDeck(table, holder));
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
