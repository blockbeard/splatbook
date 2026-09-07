/**
 * Which cards pay for which actions, in both directions.
 *
 * **Offered, never enforced.** Everything here answers "what does the book
 * suggest?" and nothing answers "may I?". The interface highlights what fits and
 * leaves everything else selectable, because a menu that lists only legal
 * choices refuses a play exactly as a rule would — and the GM rules on things
 * the book never anticipated. That is why the catalogue always carries a way to
 * say something it does not contain.
 *
 * Two different rules, depending on who is holding the card:
 *
 * **A player reads from the suit.** Ch.7: "To make a minor action, spend a
 * Challenge card whose suit *matches* the action." A Cups card pays for a Cups
 * action, and the miscellaneous actions take any suit.
 *
 * **The GM reads from the doom tier**, because the majors have no suits. A
 * lesser doom pays for any Challenge Action; a greater doom pays for a
 * creature's greater doom abilities, for any miscellaneous action *except*
 * Vigilance, or can be discarded for favour. The suit-matching rule is waived
 * for the GM's *minor* actions specifically — "the GM can play any card to take
 * a minor action" — which is a narrower exemption than it first looks.
 */

import type { CardFace } from './faces';

export interface Action {
	id: string;
	name: string;
	greaterDoomForbidden?: boolean;
	requires?: 'lesser' | 'greater';
}

export interface ActionCatalogue {
	free: Action[];
	bySuit: Record<string, Action[]>;
	anySuit: Action[];
	gmOnly: Action[];
}

/** Which suit a card belongs to, if it has one. Majors do not. */
const suitOf = (face: CardFace): string | undefined =>
	face.glyph?.match(/suit-([a-z]+)\.svg$/)?.[1];

export interface Offer {
	/** What the book suggests this card pays for. */
	fits: Action[];
	/** Everything else, still selectable — the table decides, not this. */
	rest: Action[];
}

/**
 * What a card is offered for.
 *
 * `minor` matters only for the GM, whose suitless majors are exempt from
 * suit-matching on minor actions but not on their turn.
 */
export function actionsForCard(
	catalogue: ActionCatalogue,
	face: CardFace,
	opts: { asGm?: boolean; minor?: boolean } = {}
): Offer {
	const everything = [
		...Object.values(catalogue.bySuit).flat(),
		...catalogue.anySuit,
		...(opts.asGm ? catalogue.gmOnly : [])
	];

	const fits = everything.filter((action) => {
		if (opts.asGm) {
			if (action.requires) return action.requires === (face.greaterDoom ? 'greater' : 'lesser');
			if (!face.greaterDoom) return true; // a lesser doom pays for anything
			// "You cannot typically play a greater doom card to make Challenge
			// Actions… You *can* play greater doom cards to use any miscellaneous
			// action except for Vigilance."
			return catalogue.anySuit.includes(action) && !action.greaterDoomForbidden;
		}
		const suit = suitOf(face);
		if (!suit) return catalogue.anySuit.includes(action);
		return (catalogue.bySuit[suit] ?? []).includes(action) || catalogue.anySuit.includes(action);
	});

	return { fits, rest: everything.filter((a) => !fits.includes(a)) };
}

/**
 * Which of these cards the book suggests for an action.
 *
 * The other direction of the same question, so that picking an action first
 * lights up the cards rather than sending you hunting.
 */
export function cardsForAction(
	catalogue: ActionCatalogue,
	action: Action,
	cards: CardFace[],
	opts: { asGm?: boolean; minor?: boolean } = {}
): string[] {
	return cards
		.filter((face) => actionsForCard(catalogue, face, opts).fits.some((a) => a.id === action.id))
		.map((face) => face.id);
}

/** Actions that need no card at all — talking, moving within your zone. */
export const freeActions = (catalogue: ActionCatalogue): Action[] => catalogue.free;
