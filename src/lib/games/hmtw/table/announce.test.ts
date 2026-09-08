import { describe as suite, expect, it } from 'vitest';
import { announce, describe, type TableEvent } from './announce';

const names: Record<string, string> = { s1: 'Grimwold', s2: 'Aldis', gm: 'The GM' };
const nameOf = (id: string | null | undefined) => (id && names[id]) || 'Someone';

const ev = (kind: string, data: unknown, version = 1): TableEvent => ({ version, kind, data });

suite('saying what happened', () => {
	it('names the round and both hand sizes, which is the whole of a deal', () => {
		expect(describe(ev('begin-round', { round: 3, playerHand: 4, gmHand: 5 }), nameOf)).toBe(
			'Round 3 dealt. Players draw 4, the GM draws 5.'
		);
	});

	it('calls the count, because that is how the table says it is your turn', () => {
		expect(describe(ev('count', { count: 7 }), nameOf)).toBe('Initiative 7.');
		expect(describe(ev('count', { count: null }), nameOf)).toBe('The count has stopped.');
	});

	it('says what a facedown card is for, and never what it is', () => {
		const said = describe(ev('place-facedown', { holder: 's1', label: 'Riposte' }), nameOf);
		expect(said).toBe('Grimwold laid a card face down for Riposte.');
		// There is nothing else it *could* say: the event carries no card.
	});

	suite('moves, in the table’s own terms rather than in zone ids', () => {
		const move = (from: string, to: string, seat = 's1') => ev('move', { from, to, seat });

		it('a card played', () => {
			expect(describe(move('seat:s1:hand', 'seat:s1:played'), nameOf)).toBe(
				'Grimwold played a card.'
			);
		});

		it('an initiative card, credited to whose slot it landed in', () => {
			// The GM places initiative for the enemies; the player for themselves.
			expect(describe(move('deck:player', 'seat:s2:initiative', 's2'), nameOf)).toBe(
				'Aldis placed an initiative card.'
			);
		});

		it('a discard from hand, and a card that merely arrived there', () => {
			expect(describe(move('seat:s1:hand', 'discard:player'), nameOf)).toBe(
				'Grimwold discarded a card.'
			);
			expect(describe(move('fate', 'discard:player'), nameOf)).toBe(
				'A card went to the player discard.'
			);
		});

		it('a Test of Fate, and an inspiration card', () => {
			expect(describe(move('deck:player', 'fate'), nameOf)).toBe(
				'Grimwold turned a card over for a Test of Fate.'
			);
			expect(describe(move('discard:player', 'seat:s1:durable'), nameOf)).toBe(
				'Grimwold took an inspiration card.'
			);
		});

		it('treats an enemy’s row as a play, because that is what the GM does there', () => {
			expect(describe(move('seat:s2:hand', 'opponent:imps:played', 's2'), nameOf)).toBe(
				'Aldis played a card.'
			);
		});

		it('falls back to something true rather than reading zone ids aloud', () => {
			// A card slid straight into a facedown slot without a declaration —
			// possible, since the table refuses nothing, and not one of the half
			// dozen moves worth a sentence of its own.
			expect(describe(move('seat:s1:played', 'seat:s1:facedown'), nameOf)).toBe(
				'Grimwold moved a card.'
			);
		});

		it('says nothing for a move whose shape it does not recognise', () => {
			expect(describe(ev('move', { nothing: true }), nameOf)).toBeNull();
		});
	});

	it('stays quiet for bookkeeping nobody would notice happening', () => {
		expect(describe(ev('clear-facedown', { holder: 's1' }), nameOf)).toBeNull();
		expect(describe(ev('update-opponent', { id: 'imps' }), nameOf)).toBeNull();
		expect(describe(ev('something-added-later', {}), nameOf)).toBeNull();
	});

	it('names a seat it has never heard of without falling over', () => {
		expect(describe(ev('reveal-facedown', { holder: 'gone' }), nameOf)).toBe(
			'Someone turned their face-down card over.'
		);
	});
});

suite('a batch from one poll', () => {
	it('reads the last thing worth saying, not all of them', () => {
		// Reading every event would talk over the player for as long as the table
		// is busy, and the state they need is the one it is in now.
		const said = announce(
			[
				ev('begin-round', { round: 1, playerHand: 4, gmHand: 3 }, 1),
				ev('count', { count: 2 }, 2),
				ev('count', { count: 5 }, 3)
			],
			nameOf
		);
		expect(said).toBe('Initiative 5.');
	});

	it('looks past events that have nothing to say', () => {
		expect(
			announce([ev('count', { count: 9 }, 1), ev('clear-facedown', { holder: 's1' }, 2)], nameOf)
		).toBe('Initiative 9.');
	});

	it('says nothing when nothing happened', () => {
		expect(announce([], nameOf)).toBeNull();
		expect(announce([ev('update-opponent', { id: 'x' })], nameOf)).toBeNull();
	});
});
