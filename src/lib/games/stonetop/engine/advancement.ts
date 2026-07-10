/**
 * Advancement — the Level Up rules, the rules-lawyer core of play.
 *
 * On Level Up (Stonetop, Book I "Level Up") a character with XP ≥ 6 + twice its
 * level spends that XP, gains a level, and "chooses a new move from your class
 * playbook … whose requirements you meet." This module decides which moves are
 * *legal* to pick and applies the chosen one:
 *
 *   - **Level gates** — a move's `requires.level` (2+ or 6+) must be ≤ the level
 *     being reached. You may take a level-N move as you reach level N.
 *   - **Prerequisite moves** — `requires.moves` and `childOf` must already be
 *     held.
 *   - **Repeats** — a move may be taken up to `maxTakes` times (default once);
 *     Improved Stat (×3), Big Magic (×2), etc.
 *   - **Replacements** — a move with `replaces` retires the named move when
 *     taken, and is only offered while that move is still held.
 *
 * The special cases (Would-be Hero's asterisk, Potential for Greatness → Superior
 * Stat, applying the stat bump) land in commit 40; this commit settles the
 * legality and the bookkeeping. Pure and heavily unit-tested.
 */

import type { Move, Playbook } from '../pack-schemas';
import type { StatKey, StonetopCharacter } from './character';
import { prerequisitesMet, startingMovesPlan } from './moves';
import {
	bumpStat,
	canLevelUp,
	heldMoveIds,
	statAtCap,
	syncMoveTrackers,
	xpForNextLevel
} from './play';

/** The move ids a character holds from creation alone (granted + chosen), not advancement. */
function creationMoves(character: StonetopCharacter, playbook: Playbook): Set<string> {
	const plan = startingMovesPlan(character, playbook);
	return new Set([...plan.granted, ...character.moves]);
}

/**
 * How many times a character has taken a move: once if it's a creation move,
 * plus one per advancement entry naming it. Used against `maxTakes`.
 */
export function timesTaken(
	character: StonetopCharacter,
	playbook: Playbook,
	moveId: string
): number {
	const base = creationMoves(character, playbook).has(moveId) ? 1 : 0;
	const advanced = (character.advancement ?? []).filter((a) => a.moveId === moveId).length;
	return base + advanced;
}

/** A move's take cap: `maxTakes` if given, else 1. */
export function maxTakes(move: Move): number {
	return move.maxTakes ?? 1;
}

/** Whether the character has reached this move's take cap. */
export function isMaxedOut(character: StonetopCharacter, playbook: Playbook, move: Move): boolean {
	return timesTaken(character, playbook, move.id) >= maxTakes(move);
}

/** Whether `level` is high enough for a move's level gate (default gate is 1). */
export function meetsLevel(move: Move, level: number): boolean {
	return (move.requires?.level ?? 1) <= level;
}

/**
 * Legal move choices when advancing to `atLevel`: level gate met, take cap not
 * reached, prerequisites (required moves / parent) held, and — for a
 * replacement — the move it replaces still held. Order follows the playbook.
 */
export function legalChoices(
	character: StonetopCharacter,
	playbook: Playbook,
	atLevel: number
): Move[] {
	const held = heldMoveIds(character, playbook);
	return playbook.moves.list.filter((move) => {
		if (!meetsLevel(move, atLevel)) return false;
		if (isMaxedOut(character, playbook, move)) return false;
		if (!prerequisitesMet(move, held)) return false;
		if (move.replaces && !held.has(move.replaces)) return false;
		if (!trackerGateMet(character, move)) return false;
		return true;
	});
}

/**
 * Whether a move's tracker gate is satisfied — the Would-be Hero's Superior
 * Stat opens only with all 6 marks in Potential for Greatness. Moves without a
 * `requires.tracker` are ungated.
 */
export function trackerGateMet(character: StonetopCharacter, move: Move): boolean {
	const gate = move.requires?.tracker;
	if (!gate) return true;
	const tracker = character.trackers[gate.move];
	return tracker !== undefined && tracker.marked >= gate.count;
}

/** The moves a character may pick if it Levels Up now (i.e. reaching level + 1). */
export function levelUpChoices(character: StonetopCharacter, playbook: Playbook): Move[] {
	return legalChoices(character, playbook, character.level + 1);
}

/** A player's Level Up pick: the move, and (for stat moves) which stat it bumps. */
export interface LevelUpChoice {
	moveId: string;
	stat?: StatKey;
}

/** Why a Level Up was refused, for the UI to surface. */
export type LevelUpError =
	'not-enough-xp' | 'unknown-move' | 'illegal-choice' | 'stat-required' | 'stat-capped';

/** Result of attempting a Level Up: the advanced character, or a reason it failed. */
export type LevelUpResult =
	{ ok: true; character: StonetopCharacter } | { ok: false; reason: LevelUpError };

/**
 * Apply a Level Up: spend the XP cost (6 + twice the current level), gain a
 * level, record the chosen move (with any retired move and stat bump), and
 * re-sync move-trackers so a newly-gained tracker move appears. Refuses if the
 * character lacks the XP or the pick isn't legal. Pure — returns a new character.
 */
export function applyLevelUp(
	character: StonetopCharacter,
	playbook: Playbook,
	choice: LevelUpChoice
): LevelUpResult {
	if (!canLevelUp(character)) return { ok: false, reason: 'not-enough-xp' };

	const move = playbook.moves.list.find((m) => m.id === choice.moveId);
	if (!move) return { ok: false, reason: 'unknown-move' };
	if (!levelUpChoices(character, playbook).some((m) => m.id === move.id)) {
		return { ok: false, reason: 'illegal-choice' };
	}

	// A stat-bump move (Improved/Superior Stat) needs a legal, uncapped stat.
	if (move.statBump) {
		if (!choice.stat) return { ok: false, reason: 'stat-required' };
		if (statAtCap(character, choice.stat, move.statBump.cap)) {
			return { ok: false, reason: 'stat-capped' };
		}
	}

	const newLevel = character.level + 1;
	const cost = xpForNextLevel(character.level);
	let advanced: StonetopCharacter = {
		...character,
		level: newLevel,
		xp: character.xp - cost,
		advancement: [
			...(character.advancement ?? []),
			{ level: newLevel, moveId: move.id, stat: choice.stat, replaced: move.replaces }
		]
	};
	// Apply the stat bump, capped (Improved Stat +2, Superior Stat +3).
	if (move.statBump && choice.stat) {
		advanced = bumpStat(advanced, choice.stat, move.statBump.cap) ?? advanced;
	}
	return { ok: true, character: syncMoveTrackers(advanced, playbook) };
}

/** The flag id under which a Would-be Hero records crossing off "Would-be". */
export const HERO_FLAG = 'would-be-crossed';

/** Moves flagged with the asterisk (the Would-be Hero's level-6 replacements). */
export function asteriskMoves(playbook: Playbook): Move[] {
	return playbook.moves.list.filter((m) => m.asterisk);
}

/** Whether the character holds any asterisk move (so "Would-be" can be crossed off). */
export function holdsAsteriskMove(character: StonetopCharacter, playbook: Playbook): boolean {
	const held = heldMoveIds(character, playbook);
	return asteriskMoves(playbook).some((m) => held.has(m.id));
}

/** Whether the Would-be Hero has crossed off "Would-be" (become a Hero). */
export function isWouldBeCrossed(character: StonetopCharacter): boolean {
	return character.flags?.[HERO_FLAG] === true;
}

/**
 * Whether to offer the "cross off Would-be" action: the character holds an
 * asterisk move (whose first use triggers the rule) and hasn't crossed it yet.
 */
export function canCrossOffWouldBe(character: StonetopCharacter, playbook: Playbook): boolean {
	return holdsAsteriskMove(character, playbook) && !isWouldBeCrossed(character);
}

/** Set the Would-be crossed-off flag (become a Hero, or undo). Pure. */
export function crossOffWouldBe(character: StonetopCharacter, on = true): StonetopCharacter {
	return { ...character, flags: { ...(character.flags ?? {}), [HERO_FLAG]: on } };
}
