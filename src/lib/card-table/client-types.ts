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
	opponents: { id: string; name: string; count: number }[];
	round: {
		number: number;
		count: number | null;
		minorActions: boolean;
		foolDrawn: boolean;
		interrupt: string | null;
		extraTurn: string | null;
	};
	facedown: Record<string, { position: 'turn' | 'minor'; label: string }>;
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
