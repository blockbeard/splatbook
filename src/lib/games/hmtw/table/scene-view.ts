/**
 * Who is where, read off the projected table — the summary at the top of the
 * scene panel, and the book's own "as the new round begins, restate where
 * every character is" (ch.7 step 5), said once on screen instead of out loud
 * every round.
 *
 * Derived, never stored, so it cannot disagree with the drop-downs it sums up.
 */

import type { ProjectedTable } from '$lib/card-table/client-types';
import { creatureLabel } from '../engine/creatures';

export interface Placed {
	id: string;
	label: string;
	kind: 'adventurer' | 'creature';
	/** A creature that is down: still listed, crossed out, where it fell. */
	down: boolean;
	/**
	 * A creature's Health and Defense, labelled — "Health 4/6 · Defense 2/3" —
	 * when they are tracked and this viewer is sent them, so the summary is the
	 * one place to read the fight (first live test). Labelled since Session 14,
	 * where a bare "3" beside a lion named for its stat line read as "3 3".
	 */
	stats?: string;
}

export interface ZoneRow {
	/** `null` is the "not placed" row. */
	zone: { id: string; name: string } | null;
	people: Placed[];
}

function statsOf(pool: {
	health: number;
	healthMax: number;
	defense: number;
	defenseMax: number;
}): { stats?: string } {
	const parts = [
		...(pool.healthMax > 0 ? [`Health ${pool.health}/${pool.healthMax}`] : []),
		...(pool.defenseMax > 0 ? [`Defense ${pool.defense}/${pool.defenseMax}`] : [])
	];
	return parts.length > 0 ? { stats: parts.join(' · ') } : {};
}

/** Everybody who can stand somewhere: adventurers first, in seat order, then creatures by group. */
export function placeablePeople(
	table: ProjectedTable,
	seats: readonly { id: string; name: string; status: string; isGm: boolean }[]
): Placed[] {
	const adventurers = seats
		.filter((s) => s.status === 'admitted' && !s.isGm && s.id !== table.gmSeat)
		.map((s) => ({ id: s.id, label: s.name, kind: 'adventurer' as const, down: false }));
	const creatures = table.opponents.flatMap((group) =>
		group.creatures.map((c) => {
			const pool = c.pools[0];
			return {
				id: c.id,
				label: creatureLabel(table.opponents, c.id) ?? group.name,
				kind: 'creature' as const,
				down: c.down,
				...(pool ? statsOf(pool) : {})
			};
		})
	);
	return [...adventurers, ...creatures];
}

/**
 * One row per zone, in the GM's order, then a "not placed" row if anybody is
 * unplaced. Empty zones are kept — "nobody is on the Pillar" is information.
 * With no zones named there are no rows at all: the scene has not been set.
 */
export function whoIsWhere(
	table: ProjectedTable,
	seats: readonly { id: string; name: string; status: string; isGm: boolean }[]
): ZoneRow[] {
	if (table.scene.zones.length === 0) return [];
	const people = placeablePeople(table, seats);
	const rows: ZoneRow[] = table.scene.zones.map((zone) => ({
		zone,
		people: people.filter((p) => table.scene.at[p.id] === zone.id)
	}));
	const known = new Set(table.scene.zones.map((z) => z.id));
	const unplaced = people.filter((p) => {
		const at = table.scene.at[p.id];
		return !at || !known.has(at);
	});
	if (unplaced.length > 0) rows.push({ zone: null, people: unplaced });
	return rows;
}

/**
 * The ids of the people standing in zones a new list would remove — what the
 * GM is asked about before saving, because re-adding a zone does not put them
 * back.
 */
export function strandedBy(
	table: ProjectedTable,
	keep: readonly string[],
	people: readonly Placed[]
): Placed[] {
	const kept = new Set(keep);
	return people.filter((p) => {
		const at = table.scene.at[p.id];
		return typeof at === 'string' && !kept.has(at);
	});
}
