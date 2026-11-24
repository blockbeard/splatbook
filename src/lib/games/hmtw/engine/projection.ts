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
import { upCount, type Opponent, type CardTable } from './table';
import type { TableMode } from './mode';
import type { Round } from './round';
import type { Scene } from './scene';
import { opponentZone, seatZone, type Zone, type ZoneVisibility } from './zones';

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
	/** Which view is up. Public: everyone at a table is at the same one. */
	mode: TableMode;
	gmSeat: string | null;
	/** Each group with its creatures, and `count` — how many are still up. */
	opponents: (Opponent & { count: number })[];
	round: Round;
	/**
	 * The declared actions on facedown cards — public by the book's own rule,
	 * even though the cards they describe are not.
	 */
	facedown: Record<string, FacedownAction>;
	scene: Scene;
	zones: Record<string, ProjectedZone>;
	/** Who this was built for, so a client can tell whose view it holds. */
	viewer: string | null;
	/** Whether the table is walking the round for whoever is looking. */
	guided: boolean;
	/**
	 * Whose initiative the count has reached — seat and opponent ids.
	 *
	 * Computed on the server, because the values it reads are facedown and no
	 * client holds them. It discloses exactly what the count-up discloses and
	 * not a card more: the GM calls a number, whoever holds it says so, and the
	 * table now says it for them. Empty while nobody is counting, so a prompt
	 * can never run ahead of the call.
	 */
	upNow: string[];
	/**
	 * Every placed initiative has had its turn and its minor actions: ch.7's
	 * "the round is over". A yes/no and nothing more — it says that nobody is
	 * left to go, which the table already knows, and nothing about any card.
	 */
	roundDone: boolean;
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
		mode: table.mode,
		guided: table.guided,
		upNow: whoIsUp(table),
		roundDone: roundIsDone(table),
		gmSeat: table.gmSeat,
		opponents: table.opponents.map((o) => ({
			...o,
			count: upCount(o),
			creatures: o.creatures.map((c) => ({ ...c, pools: c.pools.map((p) => ({ ...p })) }))
		})),
		round: { ...table.round },
		facedown: Object.fromEntries(Object.entries(table.facedown).map(([k, v]) => [k, { ...v }])),
		scene: {
			zones: table.scene.zones.map((z) => ({ ...z })),
			at: { ...table.scene.at }
		},
		zones,
		viewer: viewer ?? null
	};
}

/**
 * Whose initiative matches the number currently being called.
 *
 * Reads facedown cards, which is why it lives on the server. It returns nothing
 * at all while `count` is null, so nothing can be learned before the GM starts
 * counting — and once counting, it says only what saying the number out loud
 * already says.
 */
/**
 * Whether the count has passed everybody: it is running, the current number is
 * settled (its turn and minor actions done), nobody is interrupting or owed a
 * turn, the minor-action window is shut, and no initiative card on the table is
 * worth more than the number reached. Seats that never put an initiative down
 * do not hold the round open — a physical table would not wait for them either.
 */
export function roundIsDone(table: CardTable): boolean {
	const { count, settled, interrupt, extraTurn, minorActions } = table.round;
	if (count === null || settled !== count || interrupt || extraTurn || minorActions) return false;
	const slots = [
		...table.seats.map((s) => seatZone(s, 'initiative')),
		...table.opponents.map((o) => opponentZone(o.id, 'initiative'))
	];
	let anyPlaced = false;
	for (const slot of slots) {
		const card = table.zones[slot]?.cards[0];
		if (card === undefined) continue;
		anyPlaced = true;
		if ((table.valueOf[card] ?? 0) > count) return false;
	}
	return anyPlaced;
}

export function whoIsUp(table: CardTable): string[] {
	const count = table.round.count;
	if (count === null) return [];

	const holders: string[] = [];
	const at = (zoneId: string, holder: string) => {
		const card = table.zones[zoneId]?.cards[0];
		if (card !== undefined && table.valueOf[card] === count) holders.push(holder);
	};
	for (const seat of table.seats) at(seatZone(seat, 'initiative'), seat);
	for (const opponent of table.opponents) {
		at(opponentZone(opponent.id, 'initiative'), opponent.id);
	}
	return holders;
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
