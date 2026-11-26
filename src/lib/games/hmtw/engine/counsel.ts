/**
 * Counsel: handing a card to another adventurer (phase 33).
 *
 * "Any time during a Challenge, you may yell advice to another adventurer and
 * hand the player a card from your hand. The card's suit must match the action
 * you counsel them to take. The other player may play that card as long as
 * they use it to take your advice." Spend a Resolve, and they may play it as
 * an interrupt.
 *
 * In Session 14 a player had to play his Counsel card as another player's
 * Recover, because there was no way to hand a card over. The card goes into
 * the other player's hand, not a second face-down slot: "you may only have
 * one facedown action at a time", and a hand has no such limit.
 *
 * As everywhere, nothing is enforced: the suit isn't checked, and the card can
 * be played for anything. The table only remembers the advice, so the receiver
 * sees what it was for.
 */

import type { Pick } from './moves';
import type { CardTable } from './table';
import { seatZone } from './zones';

export interface Counsel {
	/** The adventurer who gave it. */
	from: string;
	/** The adventurer who holds it. */
	to: string;
	/** The action counselled: "Recover". Public, as the advice is shouted. */
	action: string;
	/** A Resolve was spent: it may be played as an interrupt. */
	interrupt: boolean;
}

export type GiveFailure =
	| 'wrong-mode'
	| 'no-such-seat'
	| 'not-to-yourself'
	| 'not-to-the-gm'
	| 'not-yours'
	| 'no-such-card'
	| 'empty';

export type GiveResult =
	{ ok: true; table: CardTable; card: string } | { ok: false; reason: GiveFailure };

/**
 * Hand a card from one adventurer's hand to another's, with the advice.
 *
 * Moved directly rather than through `moveCard`, whose reach rules keep
 * everyone's hand to its owner: putting a card into somebody else's hand is
 * exactly what this talent is for. The command layer has already checked that
 * the giver is whoever asked, or the GM.
 */
export function giveCard(
	table: CardTable,
	giver: string,
	to: string,
	from: Pick,
	advice: { action: string; interrupt: boolean }
): GiveResult {
	if (table.mode !== 'challenge') return { ok: false, reason: 'wrong-mode' };
	if (!table.seats.includes(giver) || !table.seats.includes(to)) {
		return { ok: false, reason: 'no-such-seat' };
	}
	if (to === giver) return { ok: false, reason: 'not-to-yourself' };
	if (to === table.gmSeat || giver === table.gmSeat) return { ok: false, reason: 'not-to-the-gm' };
	const handId = seatZone(giver, 'hand');
	if (from.zone !== handId) return { ok: false, reason: 'not-yours' };
	const hand = table.zones[handId];
	const target = table.zones[seatZone(to, 'hand')];
	if (!hand || !target) return { ok: false, reason: 'no-such-seat' };
	const card = from.card ?? hand.cards[0];
	if (card === undefined) return { ok: false, reason: 'empty' };
	if (!hand.cards.includes(card)) return { ok: false, reason: 'no-such-card' };

	return {
		ok: true,
		card,
		table: {
			...table,
			zones: {
				...table.zones,
				[hand.id]: { ...hand, cards: hand.cards.filter((c) => c !== card) },
				[target.id]: { ...target, cards: [card, ...target.cards] }
			},
			counsel: {
				...liveCounsel(table),
				[card]: { from: giver, to, action: advice.action, interrupt: advice.interrupt }
			}
		}
	};
}

/**
 * The advice still riding on a card in its receiver's hand. Once the card is
 * played, discarded or swept, the advice is spent, so it is never stored past
 * the next change and never shown for a card that has moved on.
 */
export function liveCounsel(table: CardTable): Record<string, Counsel> {
	const live: Record<string, Counsel> = {};
	for (const [card, advice] of Object.entries(table.counsel ?? {})) {
		if (table.zones[seatZone(advice.to, 'hand')]?.cards.includes(card)) live[card] = advice;
	}
	return live;
}

/**
 * What one viewer is told: the advice on the cards in their own hand, keyed by
 * card. Nobody else gets the card ids, the giver included, who knows which card
 * it was anyway; the log tells everyone that a card was handed over, and what for.
 */
export function counselFor(table: CardTable, viewer?: string): Record<string, Counsel> {
	if (viewer === undefined) return {};
	return Object.fromEntries(
		Object.entries(liveCounsel(table)).filter(([, advice]) => advice.to === viewer)
	);
}
