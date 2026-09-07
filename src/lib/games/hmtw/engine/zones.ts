/**
 * Zones — every place a card can be on the table, and who may see what is in it.
 *
 * A zone is an ordered list of card ids with a visibility and a capacity. That
 * is the whole model, and it is deliberately small: "flip the top of the deck
 * into the discard" and "reveal your facedown card" are the *same operation*
 * (move a card from one zone to another) and differ only in which zones they
 * name. Visibility is a property of the destination, so flipping is not a
 * separate verb — see `moves.ts`.
 *
 * Zone ids are strings with a shape (`deck:player`, `seat:s1:hand`) rather than
 * a nested object graph, because a command names one and the wire should carry
 * something short, stable, and greppable.
 */

/** Who may see the *faces* of the cards in a zone. Order is never secret; identity is. */
export type ZoneVisibility =
	/** Everyone at the table sees the faces: discards, played cards, durable slots. */
	| 'public'
	/** Only the owning seat sees the faces: a hand, a facedown card, an unrevealed initiative. */
	| 'owner'
	/**
	 * Whoever holds the GM seat sees the faces: an opponent's initiative before
	 * the count reaches it, an opponent's facedown card.
	 *
	 * A role rather than an owner id, deliberately. The GM seat changes hands —
	 * a vacant one may be claimed by anyone, which is what stops a lost cookie
	 * locking out a table whose joins the GM has to approve — and a zone that
	 * stored a concrete owner would have to be rewritten on every handover.
	 * Resolved against the table's `gmSeat` when a view is projected.
	 */
	| 'gm'
	/** Nobody sees the faces, including the owner: the draw piles. */
	| 'hidden';

export interface Zone {
	id: string;
	/** Seat id, or `null` for a zone belonging to the table rather than a person. */
	owner: string | null;
	visibility: ZoneVisibility;
	/** `null` is unbounded. The book caps some places at one card. */
	capacity: number | null;
	/** Index 0 is the top of the pile — what a draw or a flip takes. */
	cards: string[];
}

/** The two physical decks. */
export type DeckId = 'player' | 'gm';

/** The per-seat zones this commit establishes. More arrive with the round. */
export type SeatZoneKind =
	/** Cards drawn and held. Private to the seat. */
	| 'hand'
	/** The round's initiative card, face down until the count reaches it. */
	| 'initiative'
	/** Cards played face up in front of a seat. */
	| 'played'
	/** A card played face down, its value private until it is revealed. */
	| 'facedown'
	/** A held card that outlives rounds and mode switches — the inspiration card. */
	| 'durable';

/**
 * The zones an opponent gets. An opponent is a seat without a hand: the GM
 * draws one hand of majors and plays from it for everything they control
 * (ch.7, "it's not practical to draw four cards per opponent").
 */
export type OpponentZoneKind = 'initiative' | 'played' | 'facedown';

export const deckZone = (deck: DeckId): string => `deck:${deck}`;
export const discardZone = (deck: DeckId): string => `discard:${deck}`;
export const seatZone = (seat: string, kind: SeatZoneKind): string => `seat:${seat}:${kind}`;

/** The zones every seat gets, with the visibility and capacity the book implies. */
export function seatZones(seat: string): Zone[] {
	const zone = (kind: SeatZoneKind, visibility: ZoneVisibility, capacity: number | null): Zone => ({
		id: seatZone(seat, kind),
		owner: seat,
		visibility,
		capacity,
		cards: []
	});
	return [
		zone('hand', 'owner', null),
		// One initiative card per round (ch.7 step 2), face down until the count
		// reaches it. It is excluded from the facedown-action limit by the book's
		// own parenthesis, which is why it is its own zone rather than a tag.
		zone('initiative', 'owner', 1),
		zone('played', 'public', null),
		zone('facedown', 'owner', null),
		// "No player can ever have more than one inspiration card" (ch.5). The cap
		// is structure, not a rule the engine enforces: a second card has nowhere
		// to go rather than being refused.
		zone('durable', 'public', 1)
	];
}

export const opponentZone = (opponent: string, kind: OpponentZoneKind): string =>
	`opponent:${opponent}:${kind}`;

/**
 * An opponent's zones. Owned by nobody in particular — they belong to the GM
 * *role*, so they survive the seat changing hands.
 */
export function opponentZones(opponent: string): Zone[] {
	const zone = (
		kind: OpponentZoneKind,
		visibility: ZoneVisibility,
		capacity: number | null
	): Zone => ({
		id: opponentZone(opponent, kind),
		owner: null,
		visibility,
		capacity,
		cards: []
	});
	return [
		// "The GM plays an Initiative card for every significant character or
		// group of characters they control" (ch.7 step 2).
		zone('initiative', 'gm', 1),
		zone('played', 'public', null),
		zone('facedown', 'gm', null)
	];
}

/** The table's own zones: two draw piles, two discards. */
export function tableZones(): Zone[] {
	const pile = (id: string, visibility: ZoneVisibility): Zone => ({
		id,
		owner: null,
		visibility,
		capacity: null,
		cards: []
	});
	return [
		pile(deckZone('player'), 'hidden'),
		pile(deckZone('gm'), 'hidden'),
		pile(discardZone('player'), 'public'),
		pile(discardZone('gm'), 'public')
	];
}
