import { describe, expect, it } from 'vitest';
import { suggest } from './guide';
import type { ProjectedTable } from '$lib/card-table/client-types';

const seats = [
	{ id: 'daria', name: 'Daria', status: 'admitted', isGm: false },
	{ id: 'chirm', name: 'Chirm', status: 'admitted', isGm: false },
	{ id: 'gm', name: 'The GM', status: 'admitted', isGm: true }
];

const table = (over: Partial<ProjectedTable> = {}): ProjectedTable =>
	({
		seats: ['daria', 'chirm', 'gm'],
		mode: 'challenge',
		gmSeat: 'gm',
		opponents: [],
		guided: true,
		upNow: [],
		round: {
			number: 1,
			count: null,
			minorActions: false,
			foolDrawn: false,
			interrupt: null,
			extraTurn: null
		},
		facedown: {},
		zones: {
			'seat:daria:initiative': { id: 'x', owner: null, visibility: 'owner', capacity: 1, count: 1 },
			'seat:chirm:initiative': { id: 'y', owner: null, visibility: 'owner', capacity: 1, count: 1 }
		},
		viewer: 'gm',
		...over
	}) as ProjectedTable;

describe('the guide', () => {
	it('opens by asking for a deal, and offers no shortcut for it', () => {
		// Dealing needs the GM's own draw count, and a button that guessed it
		// would be the guide making a ruling rather than a suggestion.
		const s = suggest(table({ round: { ...table().round, number: 0 } }), seats);
		expect(s.text).toMatch(/nobody has drawn/i);
		expect(s.action).toBeUndefined();
	});

	it('names who is still to place initiative, and does not hurry them', () => {
		const s = suggest(
			table({
				zones: {
					'seat:daria:initiative': { count: 1 },
					'seat:chirm:initiative': { count: 0 }
				} as never
			}),
			seats
		);
		expect(s.text).toContain('Chirm');
		expect(s.text).not.toContain('Daria');
		// Nothing to press: it is waiting on a person, not on a click.
		expect(s.action).toBeUndefined();
	});

	it('does not claim every initiative is down at an empty table', () => {
		// Vacuously true, and it reads as nonsense: with nobody playing and
		// nothing to fight, say what is actually missing.
		const s = suggest(table({ zones: {} as never }), [seats[2]]);
		expect(s.text).toMatch(/nobody is at the table/i);
		expect(s.action).toBeUndefined();
	});

	it('offers to start the count once everything is down', () => {
		const s = suggest(table(), seats);
		expect(s.action?.command).toEqual({ type: 'set-count', count: 1 });
		expect(s.gmOnly).toBe(true);
	});

	it('says whose number it is, once the count has reached it', () => {
		const s = suggest(table({ round: { ...table().round, count: 4 }, upNow: ['daria'] }), seats);
		expect(s.text).toBe('4 — Daria, that is you.');
	});

	it('carries on past a number nobody holds', () => {
		const s = suggest(table({ round: { ...table().round, count: 5 } }), seats);
		expect(s.text).toBe('5 — nobody.');
		expect(s.action?.command).toEqual({ type: 'advance-count' });
	});

	it('names an enemy as readily as a player', () => {
		const s = suggest(
			table({
				round: { ...table().round, count: 4 },
				upNow: ['imps'],
				opponents: [{ id: 'imps', name: 'Imps', count: 6 }]
			}),
			seats
		);
		expect(s.text).toContain('Imps');
	});

	it('reads a list the way a person would say it', () => {
		const s = suggest(
			table({
				round: { ...table().round, count: 4 },
				upNow: ['daria', 'chirm', 'imps'],
				opponents: [{ id: 'imps', name: 'Imps', count: 6 }]
			}),
			seats
		);
		expect(s.text).toBe('4 — Daria, Chirm and Imps, that is you.');
	});

	it('puts an interrupt before the turn, because the Fool always goes first', () => {
		const s = suggest(
			table({ round: { ...table().round, count: 4, interrupt: 'chirm' }, upNow: ['daria'] }),
			seats
		);
		expect(s.text).toContain('Chirm');
		expect(s.text).toMatch(/before the turn/);
	});

	it('stops saying "that is you" once the number is done', () => {
		// The loop this closes: the count still matches whoever just acted, so the
		// guide went on prompting somebody who had already had their turn and was
		// waiting for the count to move.
		const s = suggest(
			table({ round: { ...table().round, count: 4, settled: 4 }, upNow: ['daria'] }),
			seats
		);
		expect(s.text).toBe('4 is done.');
		expect(s.action?.command).toEqual({ type: 'advance-count' });
	});

	it('still names whoever is up on a number that has not been settled', () => {
		const s = suggest(
			table({ round: { ...table().round, count: 5, settled: 4 }, upNow: ['daria'] }),
			seats
		);
		expect(s.text).toBe('5 — Daria, that is you.');
	});

	it('holds the minor-action window open until the GM closes it', () => {
		const s = suggest(
			table({ round: { ...table().round, count: 4, minorActions: true }, upNow: ['daria'] }),
			seats
		);
		expect(s.text).toMatch(/minor actions/i);
		expect(s.action?.command).toEqual({ type: 'minor-actions', open: false });
	});

	it('never suggests anything before the count has begun', () => {
		// The disclosure rule: a prompt must not run ahead of the call. With no
		// count, `upNow` is empty and the guide has nobody to name.
		const s = suggest(table({ upNow: [] }), seats);
		expect(s.text).not.toMatch(/Daria|Chirm/);
	});
});
