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

/** Bumped whenever the persisted shape changes in a way that needs migration.
 * v2 (phase 5) adds the `advancement` log. v3 (phase 14) adds `inserts`.
 * v4 (phase 21) moves debilities off the individual stats and onto the
 * character as the book's three conditions. */
export const SCHEMA_VERSION = 4;

/** Stonetop's six stats, in printed sheet order. */
export const STAT_KEYS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/** A stat's assigned value. (Until v4 this also carried a per-stat
 * `debilitated` flag — see `StonetopCharacter.debilities`.) */
export interface StatValue {
	value: number;
}

/**
 * The three debilities, each covering a linked pair of stats (Harm and
 * Healing): a character is *weakened*, not "STR-debilitated" — marking it
 * affects every roll of either linked stat. The printed display names live in
 * the playbook pack (`stats.debilities`); these ids are the rules-side
 * vocabulary the pack's entries are keyed to match.
 */
export const DEBILITY_KEYS = ['weakened', 'dazed', 'miserable'] as const;
export type DebilityKey = (typeof DEBILITY_KEYS)[number];

/** Which stats each debility drags down when marked. */
export const DEBILITY_STATS: Record<DebilityKey, readonly StatKey[]> = {
	weakened: ['STR', 'DEX'],
	dazed: ['INT', 'WIS'],
	miserable: ['CON', 'CHA']
};

/** The debility a given stat belongs to (every stat has exactly one). */
export function debilityForStat(stat: StatKey): DebilityKey {
	return DEBILITY_KEYS.find((key) => DEBILITY_STATS[key].includes(stat))!;
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
 * Per-extras-section state (sacred pouch, tall tales, war stories…). A section
 * may carry nested picks (`choices`), pick-one-per-line lists (`lines`), and
 * free-text answers (`prompts`); each is optional and present only if that
 * section uses it. Stored under `StonetopCharacter.extras[sectionId]`.
 */
export interface ExtrasSectionState {
	choices?: Record<string, ChoiceSelection>;
	lines?: (string | null)[];
	prompts?: Record<number, string>;
}

/**
 * One recorded advancement: a move gained on Level Up (or the special
 * Would-be Hero cases). `level` is the level the character reached with this
 * pick; `stat` records which stat an Improved/Superior Stat move bumped; if the
 * chosen move `replaces` an earlier one, `replaced` names the retired move.
 * The full list drives the advancement log (commit 41) and take-counting.
 */
export interface AdvancementEntry {
	level: number;
	moveId: string;
	stat?: StatKey;
	replaced?: string;
}

/**
 * The Outfit/Inventory state (driven by `insert-inventory.json`). `gear` and
 * `smallItems` hold the names currently carried (marked ◇); the `undefined*`
 * counts are marks reserved during Outfit but not yet assigned to a specific
 * item — "Have What You Need" moves them onto real items later.
 */
export interface InventoryState {
	gear: string[];
	smallItems: string[];
	undefinedGear: number;
	undefinedSmall: number;
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

	/** Which of the three debilities are currently marked (v4). Each imposes
	 * disadvantage on rolls of both its linked stats — see `DEBILITY_STATS`. */
	debilities: Record<DebilityKey, boolean>;

	/** Chosen/granted move ids (order preserved for the sheet). */
	moves: string[];

	/** Selections for moves that carry nested picks (keyed by move id). */
	moveChoices: Record<string, ChoiceSelection>;

	/** Chosen possession names/ids, with selections for items that carry sub-choices. */
	possessions: string[];
	possessionChoices: Record<string, ChoiceSelection>;

	/** Per-extras-section state, keyed by section id. */
	extras: Record<string, ExtrasSectionState>;

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

	/** Moves/stat bumps gained through Level Up, in the order taken. */
	advancement: AdvancementEntry[];

	/** Playbook-specific boolean state that doesn't fit a tracker — currently the
	 * Would-be Hero's "crossed off Would-be" (see `HERO_FLAG`). Keyed for growth. */
	flags: Record<string, boolean>;

	/** Outfit/Inventory marks (driven by the inventory insert). */
	inventory: InventoryState;

	/**
	 * Attached inserts (Followers, Crew, Ghost, Invocations…), keyed by insert
	 * id (`insert-crew`, `insert-followers`…). Presence of a key means
	 * attached; the value is that insert's own state blob, shape owned by the
	 * insert itself and firmed up per-insert in commits 100-105 (empty until
	 * then). `insert-inventory` is never a key here — the Outfit has its own
	 * dedicated `inventory` field above and its own always-present tab, not a
	 * player-attached extra like the rest.
	 */
	inserts: Record<string, Record<string, unknown>>;
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
		debilities: { weakened: false, dazed: false, miserable: false },
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
		level: 1,
		advancement: [],
		flags: {},
		inventory: { gear: [], smallItems: [], undefinedGear: 0, undefinedSmall: 0 },
		inserts: {}
	};
}

/**
 * Insert ids that attach themselves once the character qualifies, rather
 * than waiting for the player to add them via the play sheet's "+" tab
 * (phase 14 intro): Invocations to the Lightbearer, Crew to the Marshal,
 * Initiates of Danu to a Blessed with the Initiate background, and Animal
 * Companion to whoever holds the Animal Companion move — not every Ranger
 * takes it, so that one keys off the move rather than the playbook.
 *
 * Evaluated against the raw blob only (playbook/background id, chosen moves,
 * advancement) — no pack data needed, so this can run inside `migrateCharacter`
 * without the engine reaching for content it doesn't own. A move granted by a
 * playbook's *fixed* starting moves (Crew, Invoke the Sun God) doesn't need
 * to appear in `character.moves` for its rule to fire — the playbook/background
 * check alone is the equivalent, since that grant is guaranteed. Exported so
 * the wizard (commit 106) can run the same rules at creation time.
 */
export function autoAttachedInsertIds(
	character: Pick<StonetopCharacter, 'playbookId' | 'backgroundId' | 'moves' | 'advancement'>
): string[] {
	const held = new Set([...character.moves, ...(character.advancement ?? []).map((a) => a.moveId)]);
	const ids: string[] = [];
	if (character.playbookId === 'the-lightbearer') ids.push('insert-invocations');
	if (character.playbookId === 'the-marshal') ids.push('insert-crew');
	if (character.playbookId === 'the-blessed' && character.backgroundId === 'initiate') {
		ids.push('insert-initiates-of-danu');
	}
	if (held.has('animal-companion')) ids.push('insert-animal-companion');
	return ids;
}

/**
 * Attach an insert. Idempotent — attaching one that's already attached
 * leaves its existing state untouched; `initialState` seeds a new attachment
 * only.
 */
export function attachInsert(
	character: StonetopCharacter,
	insertId: string,
	initialState: Record<string, unknown> = {}
): StonetopCharacter {
	if (insertId in character.inserts) return character;
	return { ...character, inserts: { ...character.inserts, [insertId]: initialState } };
}

/** Detach an insert. A no-op if it isn't attached. */
export function detachInsert(character: StonetopCharacter, insertId: string): StonetopCharacter {
	if (!(insertId in character.inserts)) return character;
	const next = { ...character.inserts };
	delete next[insertId];
	return { ...character, inserts: next };
}

/**
 * Upgrade a persisted character blob to the current shape. Tolerant of older
 * versions and partial drafts: fills any missing field from a fresh character,
 * keeps whatever the blob already has, and stamps the current `SCHEMA_VERSION`.
 * Idempotent — a current character passes through unchanged (structurally), so
 * callers can run it on every load without side effects.
 *
 * Debilities (v4): a v3-or-earlier blob marked them as a `debilitated` flag on
 * each stat. The book's rule is three conditions over linked stat pairs, so the
 * migration folds the flags up — either stat of a pair marked ⇒ that debility
 * marked — and strips the per-stat flag from the stored shape.
 *
 * `inserts` gets special handling: a blob with no `inserts` field at all (the
 * v2 shape, pre-phase-14) is a genuine one-time migration, so it's seeded with
 * whatever the character already qualifies for automatically — a saved
 * Lightbearer wakes up with Invocations attached rather than waiting for a
 * re-save. A blob that already has an `inserts` field (even `{}`) is left
 * exactly as saved: a player who detached an auto-attach insert stays
 * detached across reloads, the same as any other edit — auto-attach doesn't
 * re-run on every load, only on the version bump that introduced it.
 */
export function migrateCharacter(raw: unknown): StonetopCharacter {
	const r = (raw ?? {}) as Partial<StonetopCharacter>;
	const base = createCharacter(r.playbookId ?? null);

	// v3 → v4: per-stat `debilitated` flags become the three conditions, and the
	// flag leaves the stored stat shape. A pair with either stat marked marks
	// the whole debility — that was always one condition in the fiction.
	type LegacyStat = StatValue & { debilitated?: boolean };
	const rawStats = (r.stats ?? base.stats) as Partial<Record<StatKey, LegacyStat>>;
	const stats: Partial<Record<StatKey, StatValue>> = {};
	for (const stat of STAT_KEYS) {
		const s = rawStats[stat];
		if (s !== undefined) stats[stat] = { value: s.value };
	}
	const debilities = { ...base.debilities, ...r.debilities };
	if (r.debilities === undefined) {
		for (const key of DEBILITY_KEYS) {
			debilities[key] = DEBILITY_STATS[key].some((stat) => rawStats[stat]?.debilitated === true);
		}
	}

	const migrated: StonetopCharacter = {
		...base,
		...r,
		schemaVersion: SCHEMA_VERSION,
		origin: r.origin ?? base.origin,
		stats,
		debilities,
		hp: r.hp ?? base.hp,
		trackers: r.trackers ?? base.trackers,
		advancement: Array.isArray(r.advancement) ? r.advancement : [],
		flags: r.flags ?? {},
		inventory: r.inventory ?? base.inventory,
		inserts: r.inserts ?? base.inserts
	};
	if (r.inserts === undefined) {
		for (const id of autoAttachedInsertIds(migrated)) {
			if (!(id in migrated.inserts)) migrated.inserts = { ...migrated.inserts, [id]: {} };
		}
	}
	return migrated;
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
