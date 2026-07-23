/**
 * Stat-array assignment. A playbook prints a fixed array of six numbers; the
 * player distributes them across STR/DEX/CON/INT/WIS/CHA, each value used once.
 * Pure and unit-tested; the stats step renders against these helpers and the
 * validator gates on `isStatArrayComplete`.
 */

import { STAT_KEYS, type StatKey, type StonetopCharacter } from './character';

type Stats = StonetopCharacter['stats'];

/** Assign a value to a stat. Pure. */
export function assignStat(
	character: StonetopCharacter,
	stat: StatKey,
	value: number
): StonetopCharacter {
	return { ...character, stats: { ...character.stats, [stat]: { value } } };
}

/** Clear a stat's assignment. Pure. */
export function clearStat(character: StonetopCharacter, stat: StatKey): StonetopCharacter {
	const stats = { ...character.stats };
	delete stats[stat];
	return { ...character, stats };
}

/** The values assigned so far, as a multiset (unordered list). */
export function assignedValues(stats: Stats): number[] {
	return STAT_KEYS.flatMap((key) => (stats[key] ? [stats[key]!.value] : []));
}

/**
 * Array values not yet assigned (multiset difference `array \ assigned`).
 * `except` lets a control keep its own current value selectable while still
 * excluding the values other stats hold.
 */
export function remainingValues(array: number[], stats: Stats, except?: StatKey): number[] {
	const pool = [...array];
	for (const key of STAT_KEYS) {
		if (key === except) continue;
		const v = stats[key]?.value;
		if (v === undefined) continue;
		const i = pool.indexOf(v);
		if (i !== -1) pool.splice(i, 1);
	}
	return pool;
}

/** All six stats assigned, and their values are exactly the array (a permutation). */
export function isStatArrayComplete(array: number[], stats: Stats): boolean {
	const assigned = assignedValues(stats);
	if (assigned.length !== array.length) return false;
	const pool = [...array];
	for (const v of assigned) {
		const i = pool.indexOf(v);
		if (i === -1) return false;
		pool.splice(i, 1);
	}
	return pool.length === 0;
}
