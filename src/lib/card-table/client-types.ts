/**
 * The shapes a client sees. Deliberately structural rather than imported from
 * the engine: the shell's client code has no business knowing what a card is,
 * and a projection is only ever "zones with counts, and cards where you are
 * entitled to them".
 */

export interface ProjectedZone {
	id: string;
	owner: string | null;
	visibility: 'public' | 'owner' | 'gm' | 'hidden';
	capacity: number | null;
	count: number;
	/** Present only where this viewer may read the faces. */
	cards?: string[];
}

export interface ProjectedTable {
	seats: string[];
	/** Which view is up. Both share one pair of decks. */
	mode: 'decks' | 'challenge';
	gmSeat: string | null;
	/**
	 * Enemy groups. A group takes one turn; its creatures are the bodies, each
	 * with a letter kept for life and optional Health/Defense pools. `count` is
	 * how many are still up, derived on the server.
	 */
	opponents: {
		id: string;
		name: string;
		count: number;
		family: string;
		creatures: {
			id: string;
			letter: string;
			down: boolean;
			pools: {
				name?: string;
				health: number;
				healthMax: number;
				defense: number;
				defenseMax: number;
			}[];
		}[];
	}[];
	/** Where the round has got to; see the engine's `steps.ts`. */
	round: {
		number: number;
		count: number | null;
		foolDrawn: boolean;
		step: 'deal' | 'initiative' | 'turn' | 'minor' | 'resolve' | 'over';
		/** Who has had their turn this round. */
		acted: string[];
		/** Who has answered minor actions at this number. */
		answered: string[];
		/** Whose initiative card is face up. */
		shown: string[];
		playedHere: boolean;
		/** Who readied a minor action at this number, and may take it back (v18). */
		readiedNow?: string[];
	};
	/** What each face-up played card was for, by card id. */
	plays: Record<
		string,
		{
			by: string;
			action: string;
			/** Who it was aimed at: seats, groups or creatures (v20). */
			targets?: string[];
			/** "Everyone in <zone>": the zone's name when it was played. */
			inZone?: string;
			kind: 'turn' | 'minor' | 'readied' | 'out-of-turn';
			/** Whether its total adds the attribute; absent on a play from before v17. */
			adds?: boolean;
			number: number | null;
		}
	>;
	/** The declared action of each face-down minor-action card, by zone. */
	minorDeclared: Record<string, string>;
	/** Who each face-down minor action is aimed at, by zone (a list since v20). */
	minorTargets: Record<string, { targets: string[]; inZone?: string }>;
	/** Which face-down minor actions are a Guard, by zone (v18). */
	minorGuards?: string[];
	/** The advice on cards handed to this viewer with Counsel, by card (v19). */
	counsel?: Record<string, { from: string; to: string; action: string; interrupt: boolean }>;
	facedown: Record<string, { position: 'turn' | 'minor'; label: string }>;
	/**
	 * Whose initiative the count has reached, seats and enemies alike.
	 *
	 * Computed on the server, since it reads facedown cards. Empty while nobody
	 * is counting, so nothing here can run ahead of the GM calling a number.
	 */
	upNow: string[];
	/** Everybody who put an initiative down has had their turn: the round is over. */
	roundDone: boolean;
	/** Who shares the number being counted and has already gone (phase 33). */
	doneHere?: string[];
	/**
	 * Whether players see enemy Health and Defense. While hidden, a player's
	 * view has no pools at all; the GM's always does.
	 */
	enemyHealth: 'shown' | 'hidden';
	/**
	 * Who has an initiative card above the number reached, while counting. Ids
	 * only, never values: it is what is holding the round open.
	 */
	stillToAct: string[];
	/** Who the round is waiting on: initiative to play, or a minor action to answer. */
	waitingOn: string[];
	/**
	 * The room: the zones the GM named, and where each adventurer or creature
	 * stands. A missing or `null` entry is "not placed".
	 */
	scene: {
		zones: { id: string; name: string }[];
		at: Record<string, string | null>;
		/** The GM's picture of the room, fetched by id when it changes. */
		picture: { id: string; mime: string } | null;
	};
	zones: Record<string, ProjectedZone>;
	viewer: string | null;
}

export interface TableSnapshot {
	version: number;
	state: ProjectedTable;
	events: { version: number; kind: string; data: unknown }[];
	seatId: string | null;
	/** The roster, which changes without the table's version moving. */
	seats: { id: string; name: string; status: string; isGm: boolean }[];
	/**
	 * The server's fingerprint of the roster and this viewer's seat. Opaque:
	 * kept alongside `seats` and sent back with the next poll.
	 */
	stamp?: string;
}
