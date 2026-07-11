/**
 * Stonetop's dice presets — the game's contribution to the shell dice slot
 * (`GameModule.dice`, phase 10). Stonetop is Powered-by-the-Apocalypse: every
 * move rolls `2d6` plus one of the six stats, so the presets are a plain `2d6`
 * and a per-stat "Roll +STAT" whose `meta.stat` names the modifier the sheet's
 * dice UI resolves from the character at roll time (commit 67).
 *
 * The stat vocabulary comes from the engine's `STAT_KEYS`, not a fresh literal,
 * so the presets can never drift out of sync with the character model.
 */

import type { DiceModule, DicePreset } from '../../dice';
import { STAT_KEYS } from './engine';

/** The basic 2d6 move roll and the six stat rolls. */
const presets: DicePreset[] = [
	{ id: 'roll-2d6', label: 'Roll 2d6', notation: '2d6' },
	...STAT_KEYS.map((stat): DicePreset => ({
		id: `roll-${stat.toLowerCase()}`,
		label: `Roll +${stat}`,
		notation: '2d6',
		meta: { stat }
	}))
];

export const stonetopDice: DiceModule = { presets };
