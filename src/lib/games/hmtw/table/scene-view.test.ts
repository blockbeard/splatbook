import { describe, expect, it } from 'vitest';
import type { ProjectedTable } from '$lib/card-table/client-types';
import { placeablePeople, strandedBy, whoIsWhere } from './scene-view';

const seats = [
	{ id: 'gm', name: 'Chris', status: 'admitted', isGm: true },
	{ id: 'regan', name: 'Regan', status: 'admitted', isGm: false },
	{ id: 'tatyana', name: 'Tatyana', status: 'admitted', isGm: false },
	{ id: 'late', name: 'Bonnie', status: 'pending', isGm: false }
];

const creature = (id: string, letter: string, down = false) => ({ id, letter, down, pools: [] });

/** Session 13: the Arena and the King's Pillar, the King, and the zombie he raised. */
const table = (scene: ProjectedTable['scene']): ProjectedTable =>
	({
		gmSeat: 'gm',
		opponents: [
			{
				id: 'king',
				name: 'King of Swords',
				count: 1,
				family: 'king',
				creatures: [creature('king:A', 'A')]
			},
			{
				id: 'zombies',
				name: 'Zombie',
				count: 1,
				family: 'zombies',
				creatures: [creature('zombies:A', 'A'), creature('zombies:B', 'B', true)]
			}
		],
		scene
	}) as unknown as ProjectedTable;

const arena = [
	{ id: 'arena', name: 'Arena' },
	{ id: 'pillar', name: "King's Pillar" }
];

describe('who is where', () => {
	it('has no rows before the scene is set', () => {
		expect(whoIsWhere(table({ zones: [], at: {} }), seats)).toEqual([]);
	});

	it('lists each zone in order, keeps the empty ones, and ends with the unplaced', () => {
		const rows = whoIsWhere(
			table({ zones: arena, at: { regan: 'arena', 'king:A': 'arena', 'zombies:B': 'arena' } }),
			seats
		);
		expect(rows.map((r) => [r.zone?.name ?? null, r.people.map((p) => p.label)])).toEqual([
			['Arena', ['Regan', 'King of Swords', 'Zombie B']],
			["King's Pillar", []],
			[null, ['Tatyana', 'Zombie A']]
		]);
	});

	it('leaves out the GM and anyone still waiting to be let in', () => {
		const labels = placeablePeople(table({ zones: arena, at: {} }), seats).map((p) => p.label);
		expect(labels).not.toContain('Chris');
		expect(labels).not.toContain('Bonnie');
	});

	it('keeps a creature that is down, marked as down, where it fell', () => {
		const rows = whoIsWhere(table({ zones: arena, at: { 'zombies:B': 'pillar' } }), seats);
		expect(rows[1].people).toEqual([
			{ id: 'zombies:B', label: 'Zombie B', kind: 'creature', down: true }
		]);
	});

	it('finds who a new zone list would strand', () => {
		const t = table({ zones: arena, at: { regan: 'arena', tatyana: 'pillar' } });
		const stranded = strandedBy(t, ['pillar'], placeablePeople(t, seats));
		expect(stranded.map((p) => p.label)).toEqual(['Regan']);
	});
});
