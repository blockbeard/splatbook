/**
 * Saying what just happened, for somebody who cannot see it happen.
 *
 * A card table is almost entirely a visual object, and everything on it moves
 * because *somebody else* moved it. A sighted player catches that from the
 * corner of their eye; without it you are sitting at a table that silently
 * rearranges itself, and the one thing you most need — that the count has
 * reached your initiative — is exactly the thing nothing announces.
 *
 * The event log already carries what changed, and it is public by contract:
 * zone ids and counts, never a card. So an announcement built from it can say
 * everything it knows without a leak being possible, which is the reason this
 * reads the log rather than diffing the projection.
 *
 * One sentence per event, in the table's own words. Events that change nothing
 * a player would notice return nothing, because a live region that narrates
 * bookkeeping is worse than one that stays quiet.
 */

export interface TableEvent {
	version: number;
	kind: string;
	data: unknown;
}

/** Who a seat id belongs to, as the table shows it. */
export type NameOf = (seatId: string | null | undefined) => string;

const deckName = (deck: unknown): string => (deck === 'gm' ? 'GM' : 'player');

/** The seat a `seat:<id>:<kind>` zone belongs to, or nothing. */
const seatOfZone = (zone: string): string | null => {
	const parts = zone.split(':');
	return parts[0] === 'seat' && parts.length === 3 ? parts[1] : null;
};

const zoneKind = (zone: string): string => zone.split(':').pop() ?? '';

/**
 * A move, in the terms the table uses for it.
 *
 * Deliberately not "from zone A to zone B": the zone ids are an implementation
 * detail and reading them aloud would be worse than silence. What matters is
 * which of the half-dozen things that happen at a card table this was.
 */
function announceMove(data: { from: string; to: string; seat?: string | null }, nameOf: NameOf) {
	const who = nameOf(data.seat);
	const from = zoneKind(data.from);
	const to = zoneKind(data.to);
	const toSeat = seatOfZone(data.to);

	if (to === 'played') return `${who} played a card.`;
	if (to === 'initiative') return `${nameOf(toSeat) || who} placed an initiative card.`;
	if (to === 'durable') return `${who} took an inspiration card.`;
	if (to === 'fate') return `${who} turned a card over for a Test of Fate.`;
	if (data.to.startsWith('discard:')) {
		const deck = data.to.endsWith(':gm') ? 'GM' : 'player';
		return from === 'hand' ? `${who} discarded a card.` : `A card went to the ${deck} discard.`;
	}
	if (to === 'hand') return `${who} took a card into hand.`;
	if (data.to.startsWith('deck:'))
		return `${who} put a card back on the ${deckName(data.to.split(':')[1])} deck.`;
	return `${who} moved a card.`;
}

/**
 * What to say about one event, or nothing if it is not worth saying.
 *
 * `nameOf` resolves a seat id to the name the table shows; it should answer
 * something usable for an id it does not know, since a seat can leave between
 * an event landing and its being read.
 */
export function describe(event: TableEvent, nameOf: NameOf): string | null {
	const d = (event.data ?? {}) as Record<string, unknown>;
	switch (event.kind) {
		case 'move':
			return typeof d.from === 'string' && typeof d.to === 'string'
				? announceMove({ from: d.from, to: d.to, seat: d.seat as string | null }, nameOf)
				: null;
		case 'begin-round':
			return `Round ${d.round} dealt. Players draw ${d.playerHand}, the GM draws ${d.gmHand}.`;
		case 'end-round':
			return `Round ${d.round} ended.`;
		case 'count':
			// The one a player most needs, and the reason this exists: it is how
			// the table says your turn has come.
			return d.count === null || d.count === undefined
				? 'The count has stopped.'
				: `Initiative ${d.count}.`;
		case 'minor-actions':
			return d.open ? 'Minor actions are open.' : 'Minor actions are closed.';
		case 'place-facedown':
			return `${nameOf(d.holder as string)} laid a card face down for ${d.label}.`;
		case 'reveal-facedown':
			return `${nameOf(d.holder as string)} turned their face-down card over.`;
		case 'sweep':
			return 'The table was swept.';
		case 'mulligan':
			return 'The GM took a new hand.';
		case 'reshuffle':
			return `The ${deckName(d.deck)} deck was shuffled.`;
		case 'reset-table':
			return 'The table was reset.';
		case 'set-mode':
			return d.mode === 'challenge' ? 'The Challenge has begun.' : 'Back to the decks.';
		case 'add-opponent':
			return `${d.name} joined the fight.`;
		case 'remove-opponent':
			return 'An enemy left the fight.';
		case 'clear-fate':
			return 'The Test of Fate was cleared.';
		case 'guided':
			return d.on ? 'The table is walking the round.' : 'The table has stopped walking the round.';
		// Bookkeeping nobody would notice happening: an enemy renamed, a
		// facedown slot cleared behind a reveal. Silence is the right answer.
		default:
			return null;
	}
}

/**
 * What to put in the live region for a batch of new events.
 *
 * A poll can bring several at once, and reading all of them would talk over
 * the player for as long as the table is busy. The last one that has anything
 * to say wins — it is the state the table is in now, which is what somebody
 * catching up actually needs.
 */
export function announce(events: TableEvent[], nameOf: NameOf): string | null {
	for (let i = events.length - 1; i >= 0; i--) {
		const said = describe(events[i], nameOf);
		if (said) return said;
	}
	return null;
}
