/**
 * The Stonetop character model — the shape stored inside an entity row's `data`
 * blob (the shell owns `id`/`userId`/`gameId`/`entityType`/`name`/timestamps;
 * everything Stonetop-specific lives here).
 *
 * This is deliberately a *Stonetop* model, not a universal one (see
 * `docs/architecture.md`, "No universal character model"). It grows as the
 * wizard steps land (phase 3) and play mode/advancement firm up the trackers
 * (phase 5); `SCHEMA_VERSION` is bumped and the module migrates its own blobs.
 *
 * Everything here is pure data plus pure functions over it — no UI, DB, or
 * SvelteKit imports. That is what keeps the rules unit-testable.
 */

/** Bumped whenever the persisted shape changes in a way that needs migration. */
export const SCHEMA_VERSION = 1;

/** Stonetop's six stats, in printed sheet order. */
export const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** A stat's value plus whether its debility is currently marked (phase 5 uses the flag). */
export interface StatValue {
	value: number;
	debilitated: boolean;
}

/**
 * A box-tracker instance on a sheet (Boon, Omens, HP-style counters…). The
 * pack ships the `label`/`boxes` definition; a character carries how many are
 * `marked`. Firms up further in phase 5.
 */
export interface TrackerState {
	label: string;
	boxes: number;
	marked: number;
}

/**
 * One resolved choice from a nested pick (`subChoiceSchema` in the pack): the
 * sub-choice's `id` maps to the option labels selected, plus any free-text
 * write-in the player supplied. Kept generic so every step that offers nested
 * picks (background, possessions, extras) records choices the same way.
 */
export interface ChoiceSelection {
	/** Option labels/ids the player picked for this sub-choice. */
	selected: string[];
	/** Free-text the player typed into a write-in option, if any. */
	writeIn?: string;
}

/**
 * The character. Fields are populated as the player moves through the wizard;
 * an in-progress draft simply has `null`/empty fields for steps not yet done.
 */
export interface StonetopCharacter {
	schemaVersion: number;

	/** Chosen playbook id (`the-blessed` → stored as `blessed`? no — the pack id, e.g. `the-blessed`). */
	playbookId: string | null;

	/** Character name (chosen on the origin/name step). */
	name: string;

	/** Chosen background id, and selections for the background's nested picks. */
	backgroundId: string | null;
	backgroundChoices: Record<string, ChoiceSelection>;

	/** Chosen instinct id. */
	instinctId: string | null;
	/** Free text when the chosen instinct is the playbook's write-in option. */
	instinctWriteIn: string;

	/** One picked descriptor per printed appearance line (index-aligned to the pack). */
	appearance: (string | null)[];

	/** Origin option label and the character's name-origin note. */
	origin: { option: string | null; note: string };

	/** Assigned stat array. Empty until the stats step. */
	stats: Partial<Record<StatKey, StatValue>>;

	/** Chosen/granted move ids (order preserved for the sheet). */
	moves: string[];

	/** Selections for moves that carry nested picks (keyed by move id). */
	moveChoices: Record<string, ChoiceSelection>;

	/** Chosen possession names/ids, with selections for items that carry sub-choices. */
	possessions: string[];
	possessionChoices: Record<string, ChoiceSelection>;

	/** Per-extras-section state (sacred pouch, tall tales…); firms up as those steps land. */
	extras: Record<string, unknown>;

	/** Answers captured during the introductions ritual, keyed by step number. */
	introductions: Record<number, string>;

	/** Box trackers keyed by a stable id (e.g. move id or `hp`). */
	trackers: Record<string, TrackerState>;

	/** Base combat stats, seeded from the playbook once one is chosen. */
	damage: string | null;
	hp: { current: number; max: number };

	/** Advancement, driven in phase 5. */
	xp: number;
	level: number;
}

/**
 * A blank character. `playbookId` is optional so the wizard can create a draft
 * before or after the playbook-select step; passing it seeds nothing yet —
 * playbook-derived defaults (base HP, damage, trackers) are applied by the
 * steps that consume the pack, not here, so the engine stays pack-agnostic.
 */
export function createCharacter(playbookId: string | null = null): StonetopCharacter {
	return {
		schemaVersion: SCHEMA_VERSION,
		playbookId,
		name: '',
		backgroundId: null,
		backgroundChoices: {},
		instinctId: null,
		instinctWriteIn: '',
		appearance: [],
		origin: { option: null, note: '' },
		stats: {},
		moves: [],
		moveChoices: {},
		possessions: [],
		possessionChoices: {},
		extras: {},
		introductions: {},
		trackers: {},
		damage: null,
		hp: { current: 0, max: 0 },
		xp: 0,
		level: 1
	};
}

/** Clamp `n` into `[lo, hi]`. */
function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/**
 * Set a tracker's marked count, clamped to `[0, boxes]`. Pure — returns a new
 * tracker, never mutates. Marking a missing tracker is a no-op returning
 * `undefined` so callers can distinguish "unknown tracker" from "0 marks".
 */
export function setTrackerMarks(
	character: StonetopCharacter,
	trackerId: string,
	marked: number
): StonetopCharacter | undefined {
	const tracker = character.trackers[trackerId];
	if (!tracker) return undefined;
	const next: TrackerState = { ...tracker, marked: clamp(marked, 0, tracker.boxes) };
	return { ...character, trackers: { ...character.trackers, [trackerId]: next } };
}

/** Read a stat's value, or `undefined` if unassigned. */
export function statValue(character: StonetopCharacter, stat: StatKey): number | undefined {
	return character.stats[stat]?.value;
}
