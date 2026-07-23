/**
 * Stonetop's dice presets — the game's contribution to the shell dice slot
 * (`GameModule.dice`, phase 10). Stonetop is Powered-by-the-Apocalypse: every
 * move rolls `2d6` plus one of the six stats, so the presets are a per-stat
 * "Roll +STAT" whose `meta.stat` names the modifier. A bare `2d6` needs no
 * game-specific preset of its own — commit 107's full dice panel (`DiceRoller`)
 * always offers the whole polyhedral set plus `2d6` generically, so a redundant
 * "Roll 2d6" here would just be a second button doing the same thing.
 *
 * `resolve` is where that modifier becomes a number. The shell holds the
 * character opaquely and cannot read a stat out of it, so it hands the preset
 * and the character back here at roll time and rolls what we return. A marked
 * debility rides along as `mode: 'disadvantage'` (phase 21 — the book's
 * penalty is disadvantage on the linked stat pair, not a smaller modifier),
 * so the sheet and the dice cannot disagree about what your DEX is.
 *
 * The stat vocabulary comes from the engine's `STAT_KEYS`, not a fresh literal,
 * so the presets can never drift out of sync with the character model.
 */

import type { DiceModule, DicePreset, ResolvedRoll } from '../../dice';
import {
	STAT_KEYS,
	effectiveStat,
	markXp,
	statRollMode,
	type StatKey,
	type StonetopCharacter
} from './engine';
import { STEADING_STATS, type SteadingStatKey, type StonetopSteading } from './engine/steading';

/** The six stat rolls. */
const presets: DicePreset[] = STAT_KEYS.map((stat): DicePreset => ({
	id: `roll-${stat.toLowerCase()}`,
	label: `Roll +${stat}`,
	notation: '2d6',
	meta: { stat }
}));

/** `+1` / `-1` / `+0` — how a modifier is written on a sheet. */
export function formatModifier(value: number): string {
	return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * `2d6` plus a character's effective stat, labelled with the modifier applied —
 * the roll behind a tapped stat, and behind a move that keys off one.
 *
 * Every real stat/move roll carries `onMiss` (commit 109): a 6- on a 2d6+stat
 * roll is the book's "miss" result, and Stonetop's consolation for missing is
 * to mark XP. `rollForSteadingStat` below is a different function precisely so
 * a steading's roll — no XP track of its own — never gets this by accident.
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
		notation: `2d6${formatModifier(modifier)}`,
		mode: statRollMode(character, stat),
		onMiss: { label: 'Mark XP', apply: (c) => markXp(c as StonetopCharacter, 1) }
	};
}

function resolve(preset: DicePreset, entity: object): ResolvedRoll {
	const stat = preset.meta?.stat as StatKey | undefined;
	// A preset with no stat (plain 2d6) has nothing to resolve.
	if (!stat) return { label: preset.label, notation: preset.notation };
	return rollForStat(entity as StonetopCharacter, stat);
}

export const stonetopDice: DiceModule = { presets, resolve };

/**
 * A steading's roll: `2d6` plus one of *its* stats, never a character's. The
 * steading rolls only its own moves — at the change of seasons, +Fortunes.
 */
export function rollForSteadingStat(
	steading: StonetopSteading,
	stat: SteadingStatKey,
	moveName: string
): ResolvedRoll {
	const modifier = steading.stats[stat] ?? 0;
	return {
		label: `${moveName} +${STEADING_STATS[stat].label} (${formatModifier(modifier)})`,
		notation: `2d6${formatModifier(modifier)}`
	};
}
