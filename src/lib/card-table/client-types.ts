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
		splitFrom?: string;
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
	round: {
		number: number;
		count: number | null;
		minorActions: boolean;
		foolDrawn: boolean;
		interrupt: string | null;
		extraTurn: string | null;
		/** The number whose turn and minor actions are finished. */
		settled: number | null;
	};
	facedown: Record<string, { position: 'turn' | 'minor'; label: string }>;
	/** Whether the table is walking the round for whoever is looking. */
	guided: boolean;
	/**
	 * Whose initiative the count has reached, seats and enemies alike.
	 *
	 * Computed on the server, since it reads facedown cards. Empty while nobody
	 * is counting, so nothing here can run ahead of the GM calling a number.
	 */
	upNow: string[];
	/** Everybody who put an initiative down has had their turn: the round is over. */
	roundDone: boolean;
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
}
