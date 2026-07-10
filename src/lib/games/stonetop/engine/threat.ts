/**
 * The Stonetop threat model — the shape stored inside a *threat* entity row's
 * `data` blob (the shell owns id/userId/gameId/entityType/name/timestamps).
 *
 * A threat is Stonetop's third entity type (phase 7, commit 52): the GM's
 * worksheet for a lingering problem — its type, which map tracker it sits on
 * (Homefront / Nearby / Distant), its instinct and description, and, if it has
 * momentum, an impending doom with markable grim portents plus optional stakes
 * questions and moves. Like a steading it has no build wizard — it's an editable
 * worksheet from creation.
 *
 * This module is the pure rules layer: the shape, the tracker enum, and the few
 * operations with logic worth testing (creation defaults, migration, marking a
 * grim portent). The *display* content — the eight threat types and their move
 * lists — lives in the GM pack (`data/the-gm.json`) and is fetched by the editor,
 * exactly as playbook/steading data is. No UI, DB, or SvelteKit imports here.
 */

/** Bumped whenever the persisted threat shape changes in a way that needs migration. */
export const THREAT_SCHEMA_VERSION = 1;

/** The three threat trackers (map spreads), closest to home first. */
export const THREAT_TRACKERS = ['homefront', 'nearby', 'distant'] as const;
export type ThreatTracker = (typeof THREAT_TRACKERS)[number];

/** Printed labels for the trackers. */
export const THREAT_TRACKER_LABELS: Record<ThreatTracker, string> = {
	homefront: 'Homefront',
	nearby: 'Nearby',
	distant: 'Distant'
};

/** One grim portent — a step toward the impending doom — and whether it has come to pass. */
export interface GrimPortent {
	text: string;
	marked: boolean;
}

/**
 * A whole Stonetop threat worksheet. `threatType` is a pack threat-type id (or
 * `''` before one is picked); `tracker` is one of the three trackers; the text
 * fields and lists start empty and fill in as the GM writes the threat up.
 */
export interface StonetopThreat {
	schemaVersion: number;
	entityType: 'threat';
	name: string;
	/** Pack threat-type id (`villain`, `beast`, …), or `''` if unset. */
	threatType: string;
	tracker: ThreatTracker;
	/** Written as "to ___". */
	instinct: string;
	description: string;
	/** The ultimate bad thing, if the threat has momentum. */
	impendingDoom: string;
	/** 2–4 grim portents leading to the doom; each can be marked as it occurs. */
	grimPortents: GrimPortent[];
	/** Optional stakes questions. */
	stakes: string[];
	/** GM moves for the threat (picked from its type or written). */
	moves: string[];
	/** Optional custom player moves. */
	customMoves: string[];
}

/** A fresh, empty threat on the Homefront tracker. */
export function createThreat(): StonetopThreat {
	return {
		schemaVersion: THREAT_SCHEMA_VERSION,
		entityType: 'threat',
		name: '',
		threatType: '',
		tracker: 'homefront',
		instinct: '',
		description: '',
		impendingDoom: '',
		grimPortents: [],
		stakes: [],
		moves: [],
		customMoves: []
	};
}

/**
 * Bring an older threat blob up to the current shape. A no-op for v1; it exists
 * so the editor can call it unconditionally and future shape changes have a home
 * (mirrors `migrateSteading` / `migrateCharacter`).
 */
export function migrateThreat(raw: StonetopThreat): StonetopThreat {
	return { ...createThreat(), ...raw, schemaVersion: THREAT_SCHEMA_VERSION };
}

/** A threat with one simple field replaced (name, type, tracker, instinct, prose). Pure. */
export function setField<K extends keyof StonetopThreat>(
	threat: StonetopThreat,
	key: K,
	value: StonetopThreat[K]
): StonetopThreat {
	return { ...threat, [key]: value };
}

/** A threat with its grim portents replaced. */
export function setGrimPortents(
	threat: StonetopThreat,
	grimPortents: GrimPortent[]
): StonetopThreat {
	return { ...threat, grimPortents };
}

/** A threat with the grim portent at `index` flipped marked/unmarked. Out-of-range: no-op. */
export function toggleGrimPortent(threat: StonetopThreat, index: number): StonetopThreat {
	if (index < 0 || index >= threat.grimPortents.length) return threat;
	return {
		...threat,
		grimPortents: threat.grimPortents.map((g, i) =>
			i === index ? { ...g, marked: !g.marked } : g
		)
	};
}

/** The threat's string-list fields, each driven by an editable list in the editor. */
export type ThreatListKey = 'stakes' | 'moves' | 'customMoves';

/** A threat with one string-list field replaced. */
export function setList(
	threat: StonetopThreat,
	key: ThreatListKey,
	items: string[]
): StonetopThreat {
	return { ...threat, [key]: items };
}
