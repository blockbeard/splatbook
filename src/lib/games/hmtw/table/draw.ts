/**
 * What the table already knows about the GM's draw.
 *
 * Ch.7's checklist is rechecked every round, and three of its lines are facts
 * the table holds: how many types of enemy are still up, and whether they
 * outnumber the adventurers, or double them. The first live test (25 November
 * 2026) drew 7 where the book gave 6, because "each type of enemy" was entered
 * per enemy rather than per type. So those lines tick themselves, and the GM
 * can still change any of them. Larger than a human, an elite and a dungeon
 * lord are judgements the table cannot make, and stay with the GM.
 *
 * Keyed by the pack's `auto` names (`data/challenge.json`), not by modifier id,
 * so the pack decides which line each fact fills.
 */

export type DrawFact = 'enemy-types' | 'outnumber' | 'twice' | 'three-adventurers';

export interface DrawGroup {
	family: string;
	creatures: readonly { down: boolean }[];
}

export function gmDrawFacts(
	groups: readonly DrawGroup[],
	adventurers: number
): Record<DrawFact, boolean | number> {
	const up = groups.flatMap((g) => g.creatures.filter((c) => !c.down).map(() => g.family));
	const seated = adventurers > 0;
	return {
		'enemy-types': new Set(up).size,
		outnumber: seated && up.length > adventurers,
		// "Twice as many enemies as adventurers": the book's twelve imps against
		// four count, and seven do not, so it is at least double.
		twice: seated && up.length >= 2 * adventurers,
		'three-adventurers': adventurers === 3
	};
}
