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
	/** Who has an initiative card above the number reached. Ids only, never values. */
	stillToAct: string[];
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
 * `round.foolDrawn` is shown only to a viewer who can already see the Fool:
 * its holder, or everyone once it lies face up. It used to be public, so that
 * somebody would know to reshuffle; but `endRound` reshuffles both decks by
 * itself, and the first live test (25 November 2026) showed the notice for
 * what it was — every player told that somebody is holding the Fool.
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
		stillToAct: table.round.count === null ? [] : stillToAct(table),
		gmSeat: table.gmSeat,
		opponents: table.opponents.map((o) => ({
			...o,
			count: upCount(o),
			creatures: o.creatures.map((c) => ({ ...c, pools: c.pools.map((p) => ({ ...p })) }))
		})),
		round: {
			...table.round,
			foolDrawn:
				table.round.foolDrawn &&
				Object.values(zones).some((z) => z.cards?.some((c) => table.foolCards.includes(c)))
		},
		facedown: Object.fromEntries(Object.entries(table.facedown).map(([k, v]) => [k, { ...v }])),
		scene: {
			zones: table.scene.zones.map((z) => ({ ...z })),
			at: { ...table.scene.at },
			picture: table.scene.picture ? { ...table.scene.picture } : null
		},
		zones,
		viewer: viewer ?? null
	};
}

/**
 * Whether the count has passed everybody: it is running, nobody is
 * interrupting or owed a turn, the minor-action window is shut, no initiative
 * card on the table is worth more than the number reached — and the last
 * number is finished, either settled (its minor actions closed) or counted
 * past. Seats that never put an initiative down do not hold the round open — a
 * physical table would not wait for them either.
 *
 * "Counted past" is the first live test's missing prompt (25 November 2026).
 * Only closing the minor actions settled a number, and moving the count
 * clears that, so a GM who pressed + after the last turn, or swept instead of
 * closing minor actions, never saw the end-of-round check.
 */
export function roundIsDone(table: CardTable): boolean {
	const { count, settled, interrupt, extraTurn, minorActions } = table.round;
	if (count === null || interrupt || extraTurn || minorActions) return false;
	let highest: number | null = null;
	for (const slot of initiativeSlots(table)) {
		const card = table.zones[slot]?.cards[0];
		if (card === undefined) continue;
		const value = table.valueOf[card] ?? 0;
		if (value > count) return false;
		highest = Math.max(highest ?? 0, value);
	}
	if (highest === null) return false;
	return count > highest || settled === count;
}

/**
 * Who still has a turn to come this round: their initiative card is worth more
 * than the number reached. Ids only, never values — a GM counting aloud tells
 * the table that much, since nobody answered the numbers already called.
 */
export function stillToAct(table: CardTable): string[] {
	const count = table.round.count ?? 0;
	const holders: string[] = [];
	for (const seat of table.seats) {
		const card = table.zones[seatZone(seat, 'initiative')]?.cards[0];
		if (card !== undefined && (table.valueOf[card] ?? 0) > count) holders.push(seat);
	}
	for (const opponent of table.opponents) {
		const card = table.zones[opponentZone(opponent.id, 'initiative')]?.cards[0];
		if (card !== undefined && (table.valueOf[card] ?? 0) > count) holders.push(opponent.id);
	}
	return holders;
}

function initiativeSlots(table: CardTable): string[] {
	return [
		...table.seats.map((s) => seatZone(s, 'initiative')),
		...table.opponents.map((o) => opponentZone(o.id, 'initiative'))
	];
}

/**
 * Whose initiative matches the number currently being called.
 *
 * Reads facedown cards, which is why it lives on the server. It returns nothing
 * at all while `count` is null, so nothing can be learned before the GM starts
 * counting — and once counting, it says only what saying the number out loud
 * already says.
 */
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
