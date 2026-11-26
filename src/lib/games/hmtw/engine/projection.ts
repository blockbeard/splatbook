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

import { holdersWithInitiative, initiativeHolder } from './initiative';
import { waitingForInitiative, waitingForMinor } from './steps';
import { canSeeFaces } from './moves';
import type { FacedownAction } from './exceptions';
import { upCount, type Opponent, type CardTable } from './table';
import type { TableMode } from './mode';
import type { Round } from './round';
import type { Scene } from './scene';
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
	/** What each face-up played card was for; see `CardTable.plays`. */
	plays: CardTable['plays'];
	/** The declared action of each face-down minor-action card, by zone. */
	minorDeclared: Record<string, string>;
	/** Who each face-down minor action is aimed at, by zone. */
	minorTargets: Record<string, string>;
	/** Which face-down minor actions are a Guard, by zone. Public, as the declaration is. */
	minorGuards: string[];
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
	 * Who shares the number being counted and has already gone. Session 14
	 * (phase 33): two players on 1, the first had gone, and nothing said why
	 * the count hadn't moved, so the GM pressed again and skipped the second.
	 * Discloses nothing new: initiative at the count is face up already.
	 */
	doneHere: string[];
	/** Whether players see enemy Health; see `CardTable.enemyHealth`. */
	enemyHealth: 'shown' | 'hidden';
	/** The round is over: ch.7's step 5. A yes/no and nothing more. */
	roundDone: boolean;
	/** Who has an initiative card down and has not yet acted. Ids only, never values. */
	stillToAct: string[];
	/**
	 * Who the round is waiting on: initiative still to play, or a minor action
	 * still to answer. Ids only — who has not answered, never what anyone holds.
	 */
	waitingOn: string[];
}

function projectZone(table: CardTable, zone: Zone, viewer?: string): ProjectedZone {
	const base: ProjectedZone = {
		id: zone.id,
		owner: zone.owner,
		visibility: zone.visibility,
		capacity: zone.capacity,
		count: zone.cards.length
	};
	return canSeeFaces(table, zone, viewer) || isShown(table, zone.id)
		? { ...base, cards: [...zone.cards] }
		: base;
}

/**
 * An initiative card turned face up: its number came up, it was named as a
 * target, or its holder showed it. See `Round.shown`.
 */
function isShown(table: CardTable, zoneId: string): boolean {
	const holder = initiativeHolder(zoneId);
	return holder !== null && table.round.shown.includes(holder);
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
	const seesHealth =
		table.enemyHealth !== 'hidden' ||
		(viewer !== undefined && (!table.gmSeat || viewer === table.gmSeat));
	const zones: Record<string, ProjectedZone> = {};
	for (const zone of Object.values(table.zones)) {
		zones[zone.id] = projectZone(table, zone, viewer);
	}
	return {
		schemaVersion: table.schemaVersion,
		seats: [...table.seats],
		mode: table.mode,
		upNow: whoIsUp(table),
		doneHere: doneAtCount(table),
		roundDone: roundIsDone(table),
		stillToAct: table.round.step === 'deal' ? [] : stillToAct(table),
		waitingOn:
			table.round.step === 'initiative'
				? waitingForInitiative(table)
				: table.round.step === 'minor'
					? waitingForMinor(table)
					: [],
		gmSeat: table.gmSeat,
		enemyHealth: table.enemyHealth,
		// While enemy Health is hidden, players are sent none of it: not a
		// hidden field, no field at all. Down, and so the count, stay.
		opponents: table.opponents.map((o) => ({
			...o,
			count: upCount(o),
			creatures: o.creatures.map((c) => ({
				...c,
				pools: seesHealth ? c.pools.map((p) => ({ ...p })) : []
			}))
		})),
		round: {
			...table.round,
			acted: [...table.round.acted],
			answered: [...table.round.answered],
			shown: [...table.round.shown],
			foolDrawn:
				table.round.foolDrawn &&
				Object.values(zones).some((z) => z.cards?.some((c) => table.foolCards.includes(c)))
		},
		facedown: Object.fromEntries(Object.entries(table.facedown).map(([k, v]) => [k, { ...v }])),
		// Only labels for cards lying face up, which anyone can already see.
		plays: Object.fromEntries(Object.entries(table.plays).map(([k, v]) => [k, { ...v }])),
		minorDeclared: { ...table.minorDeclared },
		minorTargets: { ...table.minorTargets },
		minorGuards: [...table.minorGuards],
		scene: {
			zones: table.scene.zones.map((z) => ({ ...z })),
			at: { ...table.scene.at },
			picture: table.scene.picture ? { ...table.scene.picture } : null
		},
		zones,
		viewer: viewer ?? null
	};
}

/** The round is over: everybody who put an initiative down has had their turn. */
export function roundIsDone(table: CardTable): boolean {
	return table.round.step === 'over';
}

/**
 * Who still has a turn to come this round: an initiative card down and not yet
 * acted. Ids only, never values — a GM counting aloud tells the table that much,
 * since nobody answered the numbers already called.
 */
export function stillToAct(table: CardTable): string[] {
	const acted = new Set(table.round.acted);
	return holdersWithInitiative(table)
		.filter(([holder]) => !acted.has(holder))
		.map(([holder]) => holder);
}

/**
 * Whose initiative matches the number currently being called.
 *
 * Reads facedown cards, which is why it lives on the server. It returns nothing
 * at all while `count` is null, so nothing can be learned before the GM starts
 * counting — and once counting, it says only what saying the number out loud
 * already says.
 */
/** Who is on the number being counted and has already had their turn. */
export function doneAtCount(table: CardTable): string[] {
	const count = table.round.count;
	if (count === null || table.round.step !== 'turn') return [];
	const acted = new Set(table.round.acted);
	return holdersWithInitiative(table)
		.filter(([holder, value]) => value === count && acted.has(holder))
		.map(([holder]) => holder);
}

export function whoIsUp(table: CardTable): string[] {
	const count = table.round.count;
	if (count === null || table.round.step !== 'turn') return [];
	const acted = new Set(table.round.acted);
	return holdersWithInitiative(table)
		.filter(([holder, value]) => value === count && !acted.has(holder))
		.map(([holder]) => holder);
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
