/**
 * What happens to creatures during a fight: more arrive, they get hurt, they
 * go down, and a split-off group rejoins the one it came from.
 *
 * Kept apart from `table.ts` because merging moves cards, and `moves.ts`
 * already depends on the table's types.
 */

import { MAX_CREATURES, clampHd, letterIndex, makeCreatures, type Creature } from './creatures';
import { discardAll } from './moves';
import { forgetPlacements } from './scene';
import { nextLetterIndex, type CardTable, type Opponent } from './table';
import { opponentZone, type OpponentZoneKind } from './zones';

/** Creatures in letter order, which is the order they were added. */
function byLetter(creatures: Creature[]): Creature[] {
	return [...creatures].sort((a, b) => letterIndex(a.letter) - letterIndex(b.letter));
}

/** Find a creature and the group holding it. */
export function findCreature(
	table: CardTable,
	id: string
): { opponent: Opponent; creature: Creature } | null {
	for (const opponent of table.opponents) {
		const creature = opponent.creatures.find((c) => c.id === id);
		if (creature) return { opponent, creature };
	}
	return null;
}

function withCreature(
	table: CardTable,
	id: string,
	change: (creature: Creature) => Creature
): CardTable {
	return {
		...table,
		opponents: table.opponents.map((o) =>
			o.creatures.some((c) => c.id === id)
				? { ...o, creatures: o.creatures.map((c) => (c.id === id ? change(c) : c)) }
				: o
		)
	};
}

/**
 * More of the same: `count` creatures added to a group, lettered on from the
 * family's last letter, with the HD given (or the group's first creature's
 * maximums, so reinforcements arrive as fresh as the first wave). Stops at the
 * family's fifty-second letter.
 */
export function addCreatures(
	table: CardTable,
	id: string,
	count: number,
	hd?: { health?: number; defense?: number }
): CardTable {
	const group = table.opponents.find((o) => o.id === id);
	if (!group || count < 1) return table;
	const from = nextLetterIndex(table, group.family);
	if (from >= MAX_CREATURES) return table;
	const template = group.creatures[0]?.pools[0];
	const stats =
		hd ?? (template ? { health: template.healthMax, defense: template.defenseMax } : undefined);
	const added = makeCreatures(group.family, from, Math.floor(count), stats);
	return {
		...table,
		opponents: table.opponents.map((o) =>
			o.id === id ? { ...o, creatures: [...o.creatures, ...added] } : o
		)
	};
}

export type HdStat = 'health' | 'defense';

export type HdResult =
	{ ok: true; table: CardTable } | { ok: false; reason: 'no-such-creature' | 'stale' };

/**
 * Change one number on a creature: "Zombie B, Health 3 → 2".
 *
 * The caller says what it expects to replace. Anyone may change anyone's HD,
 * so two people applying the same hit at the same moment is the commonest
 * mistake this invites — and as a bare "−1" it would land twice. With the old
 * value attached, the second one finds the number already moved and fails as
 * `stale`, which the table treats as it treats two hands reaching for one card:
 * it catches up and says who got there first.
 *
 * The new value is kept between 0 and the pool's maximum. Healing past full is
 * not a thing ch.7 has.
 */
export function setHd(
	table: CardTable,
	id: string,
	change: { pool: number; stat: HdStat; from: number; to: number }
): HdResult {
	const found = findCreature(table, id);
	const pool = found?.creature.pools[change.pool];
	if (!found || !pool) return { ok: false, reason: 'no-such-creature' };
	if (pool[change.stat] !== change.from) return { ok: false, reason: 'stale' };
	const max = change.stat === 'health' ? pool.healthMax : pool.defenseMax;
	const to = Math.min(max, clampHd(change.to));
	return {
		ok: true,
		table: withCreature(table, id, (c) => ({
			...c,
			pools: c.pools.map((p, i) => (i === change.pool ? { ...p, [change.stat]: to } : p))
		}))
	};
}

/**
 * Mark a creature down, or back up. Down is not removed: the letter stays,
 * crossed out, so Zombie B is never a second zombie, and the body stays where
 * it fell. It stops counting towards the group's `upCount`.
 */
export function setDown(table: CardTable, id: string, down: boolean): CardTable {
	const found = findCreature(table, id);
	if (!found || found.creature.down === down) return table;
	return withCreature(table, id, (c) => ({ ...c, down }));
}

/**
 * Take a creature off the table altogether — added by mistake, not killed.
 * A group's last creature cannot go this way; remove the group instead.
 */
export function removeCreature(table: CardTable, id: string): CardTable {
	const found = findCreature(table, id);
	if (!found || found.opponent.creatures.length < 2) return table;
	return forgetPlacements(
		{
			...table,
			opponents: table.opponents.map((o) =>
				o.id === found.opponent.id ? { ...o, creatures: o.creatures.filter((c) => c.id !== id) } : o
			)
		},
		[id]
	);
}

/**
 * Rejoin every split-off group to its family (v13 → v14).
 *
 * Groups used to split, giving part of a group its own initiative. The first
 * live test (25 November 2026) settled that a group shares one initiative and
 * one card wherever its creatures stand, as the book has it — and each creature
 * already has its own zone and Health — so splitting went. A table saved with a
 * split group comes back as one group: the creatures with their letters and
 * places, the split-off group's cards to the GM's discard.
 */
export function rejoinSplitGroups(table: CardTable): CardTable {
	let next = table;
	for (const group of table.opponents) {
		if (group.id !== group.family) next = rejoin(next, group.id);
	}
	return next;
}

function rejoin(table: CardTable, id: string): CardTable {
	const group = table.opponents.find((o) => o.id === id);
	if (!group) return table;
	// To the family's original; failing that — it was removed since — to any of
	// its kin. With none left, the group simply becomes its own family.
	const kin = table.opponents.filter((o) => o.id !== id && o.family === group.family);
	const into = kin.find((o) => o.id === group.family) ?? kin[0];
	if (!into) {
		return {
			...table,
			opponents: table.opponents.map((o) => (o.id === id ? { ...o, family: o.id } : o))
		};
	}

	let next = table;
	const kinds: OpponentZoneKind[] = ['initiative', 'played', 'facedown'];
	for (const kind of kinds) next = discardAll(next, opponentZone(id, kind), 'gm');

	const prefix = `opponent:${id}:`;
	const facedown = Object.fromEntries(
		Object.entries(next.facedown).filter(([zone]) => !zone.startsWith(prefix))
	);
	return {
		...next,
		facedown,
		opponents: next.opponents
			.filter((o) => o.id !== id)
			.map((o) =>
				o.id === into.id ? { ...o, creatures: byLetter([...o.creatures, ...group.creatures]) } : o
			),
		zones: Object.fromEntries(
			Object.entries(next.zones).filter(([zone]) => !zone.startsWith(prefix))
		)
	};
}
