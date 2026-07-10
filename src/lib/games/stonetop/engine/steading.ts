/**
 * The Stonetop steading model — the shape stored inside a steading entity row's
 * `data` blob (the shell owns id/userId/gameId/entityType/name/timestamps).
 *
 * A steading is Stonetop's *second* entity type (phase 6). Unlike a character it
 * has no build wizard: it is an editable tracker sheet from birth, seeded with
 * Stonetop's starting values and edited in place. This module is the pure rules
 * layer for it — the six steading stats and their legal ranges, the season
 * cycle, the three debilities, and the containers for resources, fortifications,
 * assets, improvements, residents and neighbours. No UI, DB, or SvelteKit
 * imports; everything here is plain data plus pure functions over it.
 *
 * Display *content* — the printed starting Resources/Fortifications, the
 * Improvements catalogue, the resident name and trait lists — lives in the pack
 * (`data/the-steading.json`) and is fetched by the editor, exactly as playbook
 * data is fetched for the character wizard. What lives here is the *rules*: the
 * stat ranges the tracker clamps to, and the season/debility state machine.
 */

/** Bumped whenever the persisted steading shape changes in a way that needs migration. */
export const STEADING_SCHEMA_VERSION = 1;

/** The four seasons, in turn order. Fortunes are rolled as the seasons change. */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** Size ladder, smallest to largest. Improvements (e.g. Township) move a steading up it. */
export const SIZE_LADDER = ['hamlet', 'village', 'town', 'city'] as const;
export type SteadingSize = (typeof SIZE_LADDER)[number];

/**
 * The five *numeric* steading stats, in printed sheet order. Size is tracked
 * separately (it's a ladder, not a number). `surplus` is an unbounded resource
 * pool (floored at 0); the rest are printed −1…+3 tracks.
 */
export const STEADING_STAT_KEYS = [
	'fortunes',
	'surplus',
	'population',
	'prosperity',
	'defenses'
] as const;
export type SteadingStatKey = (typeof STEADING_STAT_KEYS)[number];

/** A numeric stat's legal range and starting value (Stonetop 2nd printing). */
export interface SteadingStatDef {
	label: string;
	start: number;
	min: number;
	/** Upper clamp, or `null` for an unbounded pool (Surplus). */
	max: number | null;
}

export const STEADING_STATS: Record<SteadingStatKey, SteadingStatDef> = {
	fortunes: { label: 'Fortunes', start: 1, min: -1, max: 3 },
	surplus: { label: 'Surplus', start: 1, min: 0, max: null },
	population: { label: 'Population', start: 0, min: -1, max: 3 },
	prosperity: { label: 'Prosperity', start: 0, min: -1, max: 3 },
	defenses: { label: 'Defenses', start: 0, min: -1, max: 3 }
};

export const STARTING_SIZE: SteadingSize = 'village';

/** The three steading debilities (id → printed name/effect firmed up in the pack). */
export const STEADING_DEBILITY_KEYS = ['diminished', 'lacking', 'malcontent'] as const;
export type SteadingDebilityKey = (typeof STEADING_DEBILITY_KEYS)[number];

/**
 * Per-improvement progress. Requirement legality (which slots satisfy an
 * `all`/`either`/`pick`/`andThen` group) is the concern of commit 45; here we
 * hold what the player has ticked. `checked` are the satisfied requirement slot
 * keys; `boxes` maps a multi-box slot key to how many ◇ are filled; `completed`
 * records that the improvement's effects have been taken (stat bumps are applied
 * by hand on the tracker — the model doesn't silently mutate stats).
 */
export interface ImprovementState {
	checked: string[];
	boxes: Record<string, number>;
	completed: boolean;
}

/** One NPC living in the steading. */
export interface ResidentRow {
	name: string;
	occupation: string;
	notes: string;
}

/** One NPC from a neighbouring place. */
export interface NeighborRow {
	name: string;
	home: string;
	occupation: string;
	notes: string;
}

/** A custom Improvement the GM revealed (the printed blank cards). */
export interface CustomImprovement {
	name: string;
	summary: string;
	requirements: string;
	effects: string;
}

/** Treasure held in common (free-text tallies of silver and gold). */
export interface Treasure {
	silver: string;
	gold: string;
}

/** The steading's safety-tools lists (kept in sync with the GM playbook). */
export interface SafetyLists {
	excluded: string[];
	veiled: string[];
	specialHandling: string[];
}

/** A marked point on the steading map. */
export interface PlaceOfInterest {
	marker: string;
	name: string;
}

/**
 * A whole Stonetop steading. `stats` holds the five numeric tracks; `size` and
 * `season` are their own small state machines; the list fields start empty and
 * are seeded from the pack when a steading is first created in the editor.
 */
export interface StonetopSteading {
	schemaVersion: number;
	entityType: 'steading';
	name: string;
	stats: Record<SteadingStatKey, number>;
	size: SteadingSize;
	season: Season;
	debilities: Record<SteadingDebilityKey, boolean>;
	/** Whether the pack's starting Resources/Fortifications/Places/Assets have
	 * been seeded. False on a fresh draft; the editor seeds once, then sets this
	 * so an emptied list isn't silently refilled. */
	seeded: boolean;
	resources: string[];
	fortifications: string[];
	placesOfInterest: PlaceOfInterest[];
	assets: string[];
	treasure: Treasure;
	improvements: Record<string, ImprovementState>;
	customImprovements: CustomImprovement[];
	residents: ResidentRow[];
	neighbors: NeighborRow[];
	safety: SafetyLists;
}

/** The slice of the steading pack `createSteading` seeds starting content from. */
export interface SteadingSeed {
	resources: { starting: string[] };
	fortifications: { starting: string[] };
	placesOfInterest: { starting: PlaceOfInterest[] };
	assets: { starting: string[] };
}

/** Starting values for the numeric stats, from `STEADING_STATS`. */
function startingStats(): Record<SteadingStatKey, number> {
	const stats = {} as Record<SteadingStatKey, number>;
	for (const key of STEADING_STAT_KEYS) stats[key] = STEADING_STATS[key].start;
	return stats;
}

/** No debilities marked. */
function noDebilities(): Record<SteadingDebilityKey, boolean> {
	const d = {} as Record<SteadingDebilityKey, boolean>;
	for (const key of STEADING_DEBILITY_KEYS) d[key] = false;
	return d;
}

/**
 * A fresh steading at its printed starting stats. Content lists start empty; the
 * editor seeds the pack's starting Resources/Fortifications/Places/Assets on
 * first creation (so a returning saved steading isn't re-seeded).
 */
export function createSteading(): StonetopSteading {
	return {
		schemaVersion: STEADING_SCHEMA_VERSION,
		entityType: 'steading',
		name: '',
		stats: startingStats(),
		size: STARTING_SIZE,
		season: 'spring',
		debilities: noDebilities(),
		seeded: false,
		resources: [],
		fortifications: [],
		placesOfInterest: [],
		assets: [],
		treasure: { silver: '', gold: '' },
		improvements: {},
		customImprovements: [],
		residents: [],
		neighbors: [],
		safety: { excluded: [], veiled: [], specialHandling: [] }
	};
}

/**
 * Bring an older steading blob up to the current shape. A no-op for v1; it
 * exists so the editor can call it unconditionally and future shape changes have
 * a home (mirrors the character `migrateCharacter`).
 */
export function migrateSteading(raw: StonetopSteading): StonetopSteading {
	return { ...createSteading(), ...raw, schemaVersion: STEADING_SCHEMA_VERSION };
}

/** Clamp a value into a numeric stat's legal range. */
export function clampStat(key: SteadingStatKey, value: number): number {
	const def = STEADING_STATS[key];
	const floored = Math.max(def.min, Math.round(value));
	return def.max === null ? floored : Math.min(def.max, floored);
}

/** A steading with one numeric stat set (clamped to its range). Pure — returns a copy. */
export function setStat(
	steading: StonetopSteading,
	key: SteadingStatKey,
	value: number
): StonetopSteading {
	return { ...steading, stats: { ...steading.stats, [key]: clampStat(key, value) } };
}

/** A steading with a numeric stat nudged by `delta` (clamped). */
export function bumpStat(
	steading: StonetopSteading,
	key: SteadingStatKey,
	delta: number
): StonetopSteading {
	return setStat(steading, key, steading.stats[key] + delta);
}

/** Whether a stat is already at the floor / ceiling of its range. */
export function statAtMin(key: SteadingStatKey, value: number): boolean {
	return value <= STEADING_STATS[key].min;
}
export function statAtMax(key: SteadingStatKey, value: number): boolean {
	const { max } = STEADING_STATS[key];
	return max !== null && value >= max;
}

/** A steading with its Size set (one rung of the ladder). */
export function setSize(steading: StonetopSteading, size: SteadingSize): StonetopSteading {
	return { ...steading, size };
}

/** A steading moved `delta` rungs along the size ladder (clamped to its ends). */
export function bumpSize(steading: StonetopSteading, delta: number): StonetopSteading {
	const i = SIZE_LADDER.indexOf(steading.size);
	const next = Math.min(SIZE_LADDER.length - 1, Math.max(0, i + delta));
	return { ...steading, size: SIZE_LADDER[next] };
}

/** A steading set to a specific season. */
export function setSeason(steading: StonetopSteading, season: Season): StonetopSteading {
	return { ...steading, season };
}

/** A steading advanced to the next season (winter → spring wraps the year). */
export function advanceSeason(steading: StonetopSteading): StonetopSteading {
	const i = SEASONS.indexOf(steading.season);
	return { ...steading, season: SEASONS[(i + 1) % SEASONS.length] };
}

/** Whether a given debility is currently marked. */
export function isDebilitated(steading: StonetopSteading, key: SteadingDebilityKey): boolean {
	return steading.debilities[key];
}

/** A steading with one debility set on/off. */
export function setDebility(
	steading: StonetopSteading,
	key: SteadingDebilityKey,
	marked: boolean
): StonetopSteading {
	return { ...steading, debilities: { ...steading.debilities, [key]: marked } };
}

/** A steading with one debility flipped. */
export function toggleDebility(
	steading: StonetopSteading,
	key: SteadingDebilityKey
): StonetopSteading {
	return setDebility(steading, key, !steading.debilities[key]);
}

/**
 * Seed a fresh steading's content lists from the pack's starting entries and
 * mark it `seeded`. A no-op once seeded, so a steading whose lists the player
 * later empties isn't silently refilled. Copies the arrays so the pack object
 * is never shared into saved state.
 */
export function seedFromPack(steading: StonetopSteading, pack: SteadingSeed): StonetopSteading {
	if (steading.seeded) return steading;
	return {
		...steading,
		seeded: true,
		resources: [...pack.resources.starting],
		fortifications: [...pack.fortifications.starting],
		placesOfInterest: pack.placesOfInterest.starting.map((p) => ({ ...p })),
		assets: [...pack.assets.starting]
	};
}

/** The steading's string-list fields (the ones an `EditableList` drives). */
export type SteadingListKey = 'resources' | 'fortifications' | 'assets';

/** A steading with one string-list field replaced. */
export function setList(
	steading: StonetopSteading,
	key: SteadingListKey,
	items: string[]
): StonetopSteading {
	return { ...steading, [key]: items };
}

/** A steading with its Places of Interest replaced. */
export function setPlaces(steading: StonetopSteading, places: PlaceOfInterest[]): StonetopSteading {
	return { ...steading, placesOfInterest: places };
}

/** A steading with its treasure tallies set. */
export function setTreasure(steading: StonetopSteading, treasure: Treasure): StonetopSteading {
	return { ...steading, treasure };
}
