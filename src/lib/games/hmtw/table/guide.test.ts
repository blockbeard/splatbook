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
		upNow: [],
		roundDone: false,
		stillToAct: [],
		waitingOn: [],
		plays: {},
		minorDeclared: {},
		round: {
			number: 1,
			count: null,
			foolDrawn: false,
			step: 'initiative',
			acted: [],
			answered: [],
			shown: [],
			playedHere: false
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
	const at = (step: string, over: Partial<ProjectedTable> = {}) =>
		table({ round: { ...table().round, step, count: 4 } as ProjectedTable['round'], ...over });

	it('opens by asking for a deal, and offers no shortcut for it', () => {
		// Dealing needs the GM's own draw count, and a button that guessed it
		// would be the guide making a ruling rather than a suggestion.
		const fresh = at('deal');
		fresh.round = { ...fresh.round, number: 0 };
		const s = suggest(fresh, seats);
		expect(s.text).toMatch(/nobody has drawn/i);
		expect(s.action).toBeUndefined();
	});

	it('says a round is over between rounds, and tells players who they are waiting for', () => {
		const between = at('deal');
		expect(suggest(between, seats).text).toBe('Round 1 is over. Set the draw and deal round 2.');
		expect(suggest({ ...between, viewer: 'daria' }, seats).text).toBe(
			'Round 1 is over. Waiting for the GM to deal round 2.'
		);
		expect(suggest(between, seats).action).toBeUndefined();
	});

	it('asks whoever owes initiative to play it, and tells everyone else who is awaited', () => {
		const waiting = at('initiative', { waitingOn: ['chirm'] });
		expect(suggest({ ...waiting, viewer: 'chirm' }, seats).text).toMatch(/^Choose your initiative/);
		expect(suggest({ ...waiting, viewer: 'daria' }, seats).text).toBe(
			'Waiting on initiative from Chirm.'
		);
		// The GM can start without waiting.
		expect(suggest(waiting, seats).action?.command).toEqual({
			type: 'step-on',
			from: { step: 'initiative', count: 4, up: [] }
		});
		expect(suggest(waiting, seats).gmOnly).toBe(true);
	});

	it('asks the GM for the enemies’ initiative', () => {
		const s = suggest(
			at('initiative', {
				waitingOn: ['imps'],
				opponents: [{ id: 'imps', name: 'Imps', count: 6, family: 'imps', creatures: [] }]
			}),
			seats
		);
		expect(s.text).toMatch(/^Choose your initiative.*\(for Imps\)/);
	});

	it('does not claim anything is awaited at an empty table', () => {
		const s = suggest(at('initiative'), [seats[2]]);
		expect(s.text).toMatch(/nobody is at the table/i);
	});

	it('tells only the acting player that it is their turn', () => {
		// The first live test: "that is you" on every screen told three players
		// it was their turn when it was one player's.
		const turn = at('turn', { upNow: ['daria'] });
		expect(suggest({ ...turn, viewer: 'daria' }, seats).text).toBe(
			'4 — your turn: play a card or skip.'
		);
		expect(suggest({ ...turn, viewer: 'chirm' }, seats).text).toBe('4 — Daria to act.');
		expect(suggest({ ...turn, viewer: null }, seats).text).toBe('4 — Daria to act.');
	});

	it('tells a tied player who else acts on their number', () => {
		const s = suggest(at('turn', { upNow: ['daria', 'chirm'], viewer: 'chirm' }), seats);
		expect(s.text).toBe('4 — your turn: play a card or skip. Daria also acts on 4.');
	});

	it('says why the count stayed put when somebody on the number has gone (Session 14)', () => {
		// Bonnie and Tatyana on 1; Bonnie's turn is done and cleared.
		const tied = at('turn', { upNow: ['chirm'], doneHere: ['daria'] });
		expect(suggest({ ...tied, viewer: 'chirm' }, seats).text).toBe(
			'Daria and Chirm are both on 4, and Daria has gone. 4 — your turn: play a card or skip.'
		);
		expect(suggest(tied, seats).text).toBe(
			'Daria and Chirm are both on 4, and Daria has gone. 4 — Chirm to act.'
		);
	});

	it('names who the GM’s Skip skips, and keeps it quiet', () => {
		// "Skip their turn" sat where Next had been, and the second press skipped
		// a player.
		const one = suggest(at('turn', { upNow: ['chirm'] }), seats);
		expect(one.action?.label).toBe("Skip Chirm's turn");
		expect(one.quiet).toBe(true);
		expect(one.action?.command).toEqual({
			type: 'step-on',
			from: { step: 'turn', count: 4, up: ['chirm'] }
		});
		expect(suggest(at('turn', { upNow: ['daria', 'chirm'] }), seats).action?.label).toBe(
			'Skip the turns of Daria and Chirm'
		);
	});

	it('names an enemy as readily as a player, and reads a list as a person would', () => {
		const s = suggest(
			at('turn', {
				upNow: ['daria', 'chirm', 'imps'],
				viewer: null,
				opponents: [{ id: 'imps', name: 'Imps', count: 6, family: 'imps', creatures: [] }]
			}),
			seats
		);
		expect(s.text).toBe('4 — Daria, Chirm and Imps to act.');
	});

	it('asks for minor actions, and says who is still deciding', () => {
		const minor = at('minor', { waitingOn: ['daria', 'chirm'] });
		expect(suggest({ ...minor, viewer: 'daria' }, seats).text).toBe(
			'Any minor actions? Put one down, ready one, or pass. Also waiting on Chirm.'
		);
		expect(suggest(minor, seats).text).toBe('Minor actions: waiting on Daria and Chirm.');
		expect(suggest(minor, seats).action?.label).toBe('Turn them over now');
	});

	it('hands the GM the next number once everything is face up', () => {
		const s = suggest(at('resolve', { stillToAct: ['chirm'] }), seats);
		expect(s.text).toBe(
			'4: everything is face up. Work it out, then the GM moves on. Still to act: Chirm.'
		);
		expect(s.action).toEqual({
			label: 'Next',
			command: { type: 'step-on', from: { step: 'resolve', count: 4, up: [] } }
		});
		// Next is the thing the round is waiting for: the filled button.
		expect(s.quiet).toBeFalsy();
	});

	it('says the end-of-round check to everyone when the round is over', () => {
		const words = {
			endOfRound: { text: 'Surrender? Retreat?', rule: { label: 'Retreating', page: 'p' } }
		};
		const s = suggest(at('over'), seats, words);
		expect(s.text).toBe('Surrender? Retreat?');
		expect(s.action?.command).toEqual({ type: 'end-round' });
		expect(s.rule).toEqual({ label: 'Retreating', page: 'p' });
	});
});
