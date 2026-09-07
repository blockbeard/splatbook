/**
 * What one seat is allowed to see.
 *
 * The table's own state holds every card in every zone. This is the only thing
 * a client should ever be handed, and the rule it enforces is simple: a zone's
 * card ids are included when the viewer is entitled to the faces, and replaced
 * by a count when they are not.
 *
 * A count is not a leak — everyone at a physical table can see how many cards
 * are in your hand and roughly how thick the deck is. An id is: card ids are
 * the whole secret, so the discipline is that they either belong in a viewer's
 * projection or they do not appear in it at all, anywhere, in any field.
 *
 * `projection.test.ts` checks that exhaustively rather than field by field, by
 * serialising a projection and searching it for cards the viewer should not
 * know. A leak through some future field fails that test without anyone having
 * to remember to look for it.
 */

import { canSeeFaces } from './moves';
import type { FacedownAction } from './exceptions';
import type { Opponent, CardTable } from './table';
import type { Round } from './round';
import type { Zone, ZoneVisibility } from './zones';

export interface ProjectedZone {
	id: string;
	owner: string | null;
	visibility: ZoneVisibility;
	capacity: number | null;
	/** Always present: how thick the pile is, which the table can see anyway. */
	count: number;
	/** Present only when the viewer may read the faces. */
	cards?: string[];
}

export interface ProjectedTable {
	schemaVersion: number;
	seats: string[];
	gmSeat: string | null;
	opponents: Opponent[];
	round: Round;
	/**
	 * The declared actions on facedown cards — public by the book's own rule,
	 * even though the cards they describe are not.
	 */
	facedown: Record<string, FacedownAction>;
	zones: Record<string, ProjectedZone>;
	/** Who this was built for, so a client can tell whose view it holds. */
	viewer: string | null;
}

function projectZone(table: CardTable, zone: Zone, viewer?: string): ProjectedZone {
	const base: ProjectedZone = {
		id: zone.id,
		owner: zone.owner,
		visibility: zone.visibility,
		capacity: zone.capacity,
		count: zone.cards.length
	};
	return canSeeFaces(table, zone, viewer) ? { ...base, cards: [...zone.cards] } : base;
}

/**
 * The table as `viewer` may see it. Pass no viewer for the view a stranger
 * gets — public zones only, which is also the safe default.
 *
 * Note what stays public: `round.foolDrawn`. Knowing the Fool is in play is
 * information — it tells the table someone holds it — but the book requires
 * both decks to be shuffled at the end of a round in which it was drawn, and a
 * reshuffle nobody knows to perform is worse than a hand that is slightly less
 * secret. Which *hand* holds it stays hidden, which is the part that would
 * change how anyone plays.
 */
export function projectFor(table: CardTable, viewer?: string): ProjectedTable {
	const zones: Record<string, ProjectedZone> = {};
	for (const zone of Object.values(table.zones)) {
		zones[zone.id] = projectZone(table, zone, viewer);
	}
	return {
		schemaVersion: table.schemaVersion,
		seats: [...table.seats],
		gmSeat: table.gmSeat,
		opponents: table.opponents.map((o) => ({ ...o })),
		round: { ...table.round },
		facedown: Object.fromEntries(Object.entries(table.facedown).map(([k, v]) => [k, { ...v }])),
		zones,
		viewer: viewer ?? null
	};
}

/**
 * Every card id the viewer is *not* entitled to. Used by the leak tests, and
 * useful to anyone auditing a payload before it goes on the wire.
 */
export function hiddenFrom(table: CardTable, viewer?: string): string[] {
	const hidden: string[] = [];
	for (const zone of Object.values(table.zones)) {
		if (!canSeeFaces(table, zone, viewer)) hidden.push(...zone.cards);
	}
	return hidden;
}
