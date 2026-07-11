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

/** A game's dice contribution: the presets it offers. Attached to the optional
 * `GameModule.dice` slot; absent for a game with no preset rolls. */
export interface DiceModule {
	presets: readonly DicePreset[];
}
