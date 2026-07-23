/**
 * Play-mode state — the pure rules over a character *in play*, as opposed to a
 * character being *built* (that's the wizard/engine `moves`/`stats` files).
 *
 * Three kinds of state firm up here in phase 5:
 *   - **Vitals**: max/current HP and base damage, seeded from the playbook the
 *     first time a finished character enters play.
 *   - **Move trackers**: the use-boxes some moves print on the sheet (Boon,
 *     Resolve, Piety…). The pack ships each move's `{ label, boxes }`; a
 *     character carries how many are `marked`. `syncMoveTrackers` reconciles the
 *     character's tracker set with the moves it currently holds, so trackers
 *     appear when a move is gained and vanish when it's retired, marks intact.
 *   - **XP / debilities**: marking XP toward the next level, and marking the
 *     three debilities (each imposes disadvantage on rolls of its linked stat
 *     pair until treated — Harm and Healing; phase 21 corrected this from an
 *     invented per-stat −1).
 *
 * Everything is pure and returns a new character; nothing mutates. The play-mode
 * UI (commit 37) is a thin tap-to-mark shell over these functions.
 */

import type { Playbook } from '../pack-schemas';
import {
	DEBILITY_STATS,
	STAT_KEYS,
	debilityForStat,
	type DebilityKey,
	type StatKey,
	type StonetopCharacter,
	type TrackerState
} from './character';
import { startingMovesPlan } from './moves';

/**
 * Every move id a character currently holds: playbook-granted (fixed +
 * background) ∪ chosen at creation ∪ gained through advancement, minus any
 * move a later advancement `replaces` (a replacement retires the old move).
 */
export function heldMoveIds(character: StonetopCharacter, playbook: Playbook): Set<string> {
	const plan = startingMovesPlan(character, playbook);
	const advancement = character.advancement ?? [];
	const held = new Set([...plan.granted, ...character.moves, ...advancement.map((a) => a.moveId)]);
	for (const a of advancement) if (a.replaced) held.delete(a.replaced);
	return held;
}

/** Clamp `n` into `[lo, hi]`. */
function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/**
 * The XP needed to Level Up from `level`: **6 + twice your current level**
 * (Stonetop, Book I "Level Up"). Rises as the character advances.
 */
export function xpForNextLevel(level: number): number {
	return 6 + 2 * level;
}

/** Whether the character has banked enough XP to Level Up (before spending it). */
export function canLevelUp(character: StonetopCharacter): boolean {
	return character.xp >= xpForNextLevel(character.level);
}

/** Mark (or, with a negative delta, erase) XP. Never drops below 0, and has no
 * ceiling: you often earn the point that levels you mid-session and keep playing,
 * so XP banks past the threshold and the surplus carries over the level-up. */
export function markXp(character: StonetopCharacter, delta = 1): StonetopCharacter {
	return { ...character, xp: Math.max(0, character.xp + delta) };
}

/** XP held beyond what the next level costs — what carries over when you spend it. */
export function bankedXp(character: StonetopCharacter): number {
	return Math.max(0, character.xp - xpForNextLevel(character.level));
}

/**
 * Seed a finished character's vitals from its playbook, once. On first entry HP
 * fills to the playbook maximum and base damage is recorded; on a later entry
 * (max already set) the current HP is preserved, only re-clamped to the max.
 */
export function seedVitals(character: StonetopCharacter, playbook: Playbook): StonetopCharacter {
	const max = playbook.base.maxHp;
	const fresh = character.hp.max === 0;
	const current = fresh ? max : clamp(character.hp.current, 0, max);
	return {
		...character,
		hp: { current, max },
		damage: character.damage ?? playbook.base.damage
	};
}

/**
 * Reconcile the character's move-trackers with the moves it currently holds:
 * a tracker exists for every held move that prints one, with the pack's
 * `label`/`boxes` and the character's preserved `marked` (re-clamped); trackers
 * for moves no longer held are dropped. Idempotent.
 */
export function syncMoveTrackers(
	character: StonetopCharacter,
	playbook: Playbook
): StonetopCharacter {
	const held = heldMoveIds(character, playbook);
	const trackers: Record<string, TrackerState> = {};
	for (const move of playbook.moves.list) {
		if (!move.tracker || !held.has(move.id)) continue;
		const prior = character.trackers[move.id];
		trackers[move.id] = {
			label: move.tracker.label,
			boxes: move.tracker.boxes,
			marked: clamp(prior?.marked ?? 0, 0, move.tracker.boxes)
		};
	}
	return { ...character, trackers };
}

/**
 * Prepare a finished character for play: seed vitals, then sync move-trackers.
 * The play-mode loader calls this so a character built before play mode existed
 * gains its HP/damage/trackers without a migration.
 */
export function enterPlay(character: StonetopCharacter, playbook: Playbook): StonetopCharacter {
	return syncMoveTrackers(seedVitals(character, playbook), playbook);
}

/** Set current HP, clamped to `[0, max]`. Pure. */
export function setHp(character: StonetopCharacter, current: number): StonetopCharacter {
	return { ...character, hp: { ...character.hp, current: clamp(current, 0, character.hp.max) } };
}

/** Take `n` damage (HP down, floored at 0). */
export function applyDamage(character: StonetopCharacter, n: number): StonetopCharacter {
	return setHp(character, character.hp.current - n);
}

/** Heal `n` HP (up, capped at max). */
export function healHp(character: StonetopCharacter, n: number): StonetopCharacter {
	return setHp(character, character.hp.current + n);
}

/** Whether a debility is currently marked. */
export function isDebilitated(character: StonetopCharacter, key: DebilityKey): boolean {
	return character.debilities[key];
}

/** Whether a stat's *pair* debility is marked — the thing a roll cares about. */
export function isStatDebilitated(character: StonetopCharacter, stat: StatKey): boolean {
	return character.debilities[debilityForStat(stat)];
}

/** Mark or clear one of the three debilities. Pure. */
export function setDebility(
	character: StonetopCharacter,
	key: DebilityKey,
	on: boolean
): StonetopCharacter {
	return { ...character, debilities: { ...character.debilities, [key]: on } };
}

/** Whether a stat's base value is already at (or above) `cap`. */
export function statAtCap(character: StonetopCharacter, stat: StatKey, cap: number): boolean {
	const s = character.stats[stat];
	return s !== undefined && s.value >= cap;
}

/**
 * Raise a stat's base value by 1, not exceeding `cap` (Improved Stat → +2,
 * Superior Stat → +3). Returns `undefined` if the stat is unassigned or already
 * at the cap, so the caller can reject an illegal bump.
 */
export function bumpStat(
	character: StonetopCharacter,
	stat: StatKey,
	cap: number
): StonetopCharacter | undefined {
	const current = character.stats[stat];
	if (!current || current.value >= cap) return undefined;
	return {
		...character,
		stats: { ...character.stats, [stat]: { ...current, value: current.value + 1 } }
	};
}

/**
 * A stat's effective value: its assigned value, `undefined` if unassigned. A
 * marked debility does *not* change the number — the book's penalty is
 * disadvantage on the roll (see `statRollMode`), not a smaller modifier.
 */
export function effectiveStat(character: StonetopCharacter, stat: StatKey): number | undefined {
	return character.stats[stat]?.value;
}

/** How a stat rolls right now: at disadvantage while its debility is marked. */
export function statRollMode(
	character: StonetopCharacter,
	stat: StatKey
): 'normal' | 'disadvantage' {
	return isStatDebilitated(character, stat) ? 'disadvantage' : 'normal';
}

/** The playbook's name for a stat's debility (e.g. STR → "Weakened"), if any. */
export function debilityName(playbook: Playbook, stat: StatKey): string | undefined {
	return playbook.stats.debilities.find((d) => d.stats.includes(stat))?.name;
}

/** The playbook's printed name for a debility (e.g. weakened → "Weakened"),
 * falling back to the id when a pack doesn't carry it. */
export function debilityLabel(playbook: Playbook, key: DebilityKey): string {
	const first = DEBILITY_STATS[key][0];
	return playbook.stats.debilities.find((d) => d.stats.includes(first))?.name ?? key;
}

/** All effective stats, keyed by stat, skipping unassigned ones. */
export function effectiveStats(character: StonetopCharacter): Partial<Record<StatKey, number>> {
	const out: Partial<Record<StatKey, number>> = {};
	for (const stat of STAT_KEYS) {
		const v = effectiveStat(character, stat);
		if (v !== undefined) out[stat] = v;
	}
	return out;
}
