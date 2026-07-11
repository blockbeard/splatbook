/**
 * Stonetop's dice presets — the game's contribution to the shell dice slot
 * (`GameModule.dice`, phase 10). Stonetop is Powered-by-the-Apocalypse: every
 * move rolls `2d6` plus one of the six stats, so the presets are a plain `2d6`
 * and a per-stat "Roll +STAT" whose `meta.stat` names the modifier.
 *
 * `resolve` is where that modifier becomes a number. The shell holds the
 * character opaquely and cannot read a stat out of it, so it hands the preset
 * and the character back here at roll time and rolls what we return. The value
 * used is `effectiveStat`, so a marked debility is already priced in — the sheet
 * and the dice cannot disagree about what your DEX is.
 *
 * The stat vocabulary comes from the engine's `STAT_KEYS`, not a fresh literal,
 * so the presets can never drift out of sync with the character model.
 */

import type { DiceModule, DicePreset, ResolvedRoll } from '../../dice';
import { STAT_KEYS, effectiveStat, type StatKey, type StonetopCharacter } from './engine';

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

/** `+1` / `-1` / `+0` — how a modifier is written on a sheet. */
export function formatModifier(value: number): string {
	return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * `2d6` plus a character's effective stat, labelled with the modifier applied —
 * the roll behind a tapped stat, and behind a move that keys off one.
 */
export function rollForStat(
	character: StonetopCharacter,
	stat: StatKey,
	moveName?: string
): ResolvedRoll {
	const modifier = effectiveStat(character, stat) ?? 0;
	const what = moveName ?? 'Roll';
	return {
		label: `${what} +${stat} (${formatModifier(modifier)})`,
		notation: `2d6${formatModifier(modifier)}`
	};
}

function resolve(preset: DicePreset, entity: object): ResolvedRoll {
	const stat = preset.meta?.stat as StatKey | undefined;
	// A preset with no stat (plain 2d6) has nothing to resolve.
	if (!stat) return { label: preset.label, notation: preset.notation };
	return rollForStat(entity as StonetopCharacter, stat);
}

export const stonetopDice: DiceModule = { presets, resolve };
