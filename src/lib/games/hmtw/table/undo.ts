/**
 * Putting a card back.
 *
 * Not a transaction and deliberately not one. The table's undo is the undo a
 * physical table has: you pick the card up and put it back, and anybody can do
 * it — the person who misplayed, or whoever noticed. That is also why the
 * engine refuses nothing on grounds of legality. A misplay you can reverse
 * needs no gate in front of it.
 *
 * So this reads the last move off the public event log and hands back an
 * ordinary move command that reverses it. No new privilege, no new state, and
 * every guard that applies to a move applies to undoing one.
 *
 * It lives with the game rather than in the shell's `card-table/` because
 * everything it knows is His Majesty the Worm's: which event kinds can disturb
 * a pile, and what a hand's zone id looks like. A second game would name its
 * own; there is no shared shape to lift out until one does.
 *
 * The events carry zone ids and never card ids — naming the card would leak it
 * to a table that is not entitled to know — so the reversal takes whatever is
 * now on top of the destination. That is the right card exactly while nothing
 * else has landed there since, which is why anything that could have moved
 * cards in between cancels the offer.
 */

import { seatZone } from '../engine/zones';

export interface PublicEvent {
	version: number;
	kind: string;
	data: unknown;
}

interface MoveData {
	from: string;
	to: string;
	seat: string | null;
}

const isMove = (event: PublicEvent): event is PublicEvent & { data: MoveData } => {
	const d = event.data as Partial<MoveData> | null;
	return event.kind === 'move' && typeof d?.from === 'string' && typeof d?.to === 'string';
};

/**
 * The kinds that cannot have disturbed a pile — the count, the guided toggle,
 * the minor-actions flag, and the opponent roster. Anything else (a deal, a
 * sweep, a reshuffle, a reset, leaving the Challenge) may have put a different
 * card on top of the destination, and after one of those "put it back" would
 * put back the wrong card. An unknown kind is treated as disturbing, so a new
 * command added later fails closed.
 */
const MOVES_NO_CARDS = new Set([
	'count',
	'guided',
	'minor-actions',
	'add-opponent',
	'update-opponent'
]);

/**
 * A hand belongs to its seat and nobody reaches into it — not even to help.
 *
 * Seats are the only thing with a hand; an enemy has an initiative, a played
 * row and a facedown slot, and nothing to hold. So the suffix is enough to
 * recognise one, and the id it is compared against comes from the engine's own
 * naming rather than a copy of it.
 */
const isSomeoneElsesHand = (zone: string, mySeatId: string | null): boolean =>
	zone.endsWith(':hand') && (mySeatId === null || zone !== seatZone(mySeatId, 'hand'));

export interface Reversal {
	/** The command that puts it back. */
	command: unknown;
	/** What to call the button, in the table's own terms. */
	label: string;
}

/**
 * The move that would undo the most recent one, if there is one you may make.
 *
 * Returns nothing when the last move touched somebody else's hand: reaching in
 * is the one thing the table does not allow, and a button that would be refused
 * is worse than no button — the person whose hand it is can put it back
 * themselves.
 */
export function reverseOf(events: PublicEvent[], mySeatId: string | null): Reversal | null {
	for (let i = events.length - 1; i >= 0; i--) {
		const event = events[i];
		if (isMove(event)) {
			const { from, to } = event.data;
			if (isSomeoneElsesHand(to, mySeatId) || isSomeoneElsesHand(from, mySeatId)) return null;
			return {
				command: { type: 'move', from: { zone: to }, to: from },
				label: 'Put that card back'
			};
		}
		if (!MOVES_NO_CARDS.has(event.kind)) return null;
	}
	return null;
}
