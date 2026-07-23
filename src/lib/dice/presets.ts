/**
 * Dice presets — the named rolls a game contributes through its `GameModule`.
 * The generic core (notation + `roll`) knows nothing about any game; a preset is
 * how a module hands the shell a labelled, ready-to-roll expression ("Roll +DEX"
 * → `2d6`) without the shell learning the game's vocabulary.
 *
 * A preset is deliberately thin: an id, a display label, a base `notation`, and
 * an optional default `mode`. Anything game-specific — which stat a roll adds,
 * which move it belongs to — travels in the opaque `meta` bag, read only by the
 * game's own UI (phase 10, commit 67 wires move-aware rolls to these). This keeps
 * the boundary intact: the shell can list and roll presets generically while the
 * game owns their meaning.
 */

import type { RollMode } from './roll';

/** A named, rollable expression contributed by a game module. */
export interface DicePreset {
	/** Stable id, unique within the module's preset list. */
	id: string;
	/** Display label, e.g. `"Roll +DEX"`. A game-visible string — sourced from
	 * the game's own vocabulary, per the pack-boundary rule. */
	label: string;
	/** Base dice notation, parseable by `parseNotation` (`"2d6"`, `"1d20"`). A
	 * dynamic modifier (a stat, a bonus) is applied by the game UI at roll time. */
	notation: string;
	/** Default roll mode for this preset; omit for `'normal'`. */
	mode?: RollMode;
	/** Game-specific hints, opaque to the shell (e.g. `{ stat: 'dex' }`). */
	meta?: Record<string, unknown>;
}

/** What a preset actually rolls, once the entity in play is taken into account. */
export interface ResolvedRoll {
	/** The label to log and show — the game's words, e.g. `"Roll +DEX (+2)"`. */
	label: string;
	/** Concrete notation including any dynamic modifier, e.g. `"2d6+2"`. */
	notation: string;
	/**
	 * A roll mode the entity's own state imposes (phase 21) — Stonetop's marked
	 * debility makes its stat pair roll at disadvantage, and only the game can
	 * know that. The host combines this with whatever mode the player dialled
	 * into the dice panel via `combineModes` (they cancel when opposed), rather
	 * than either side silently overriding the other. Omitted = `'normal'`.
	 */
	mode?: RollMode;
	/**
	 * A follow-up worth offering if this roll turns out to total 6 or less
	 * (commit 109) — a pure `(entity) => nextEntity` update rather than a
	 * closure over `onChange`, since `resolve` only ever sees the entity, not
	 * the host's write path. The host applies it itself if the player accepts.
	 * Present on a real stat/move roll (Stonetop's `rollForStat`); absent from
	 * a bare preset with nothing to resolve, so it can never reach a base die
	 * or a damage roll by accident.
	 */
	onMiss?: { label: string; apply: (entity: object) => object };
}

/** A game's dice contribution: the presets it offers. Attached to the optional
 * `GameModule.dice` slot; absent for a game with no preset rolls. */
export interface DiceModule {
	presets: readonly DicePreset[];
	/**
	 * Resolve a preset against the entity being played — how a preset's dynamic
	 * modifier (the `meta.stat` a "Roll +DEX" carries) becomes a real number.
	 *
	 * The shell cannot do this itself: the modifier lives inside the game's own
	 * character shape, which is opaque to it. So the shell hands the preset and
	 * the entity back to the game and rolls whatever it returns. Without this
	 * hook (or with no entity in play) the shell rolls the preset's bare
	 * notation, which is right for a preset with no dynamic part.
	 */
	resolve?: (preset: DicePreset, entity: object) => ResolvedRoll;
}
