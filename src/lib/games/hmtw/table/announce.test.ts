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

	it('says when the Fool’s reshuffle happened, since nobody else was told it was out', () => {
		expect(describe(ev('end-round', { round: 2, shuffled: false }), nameOf)).toBe('Round 2 ended.');
		expect(describe(ev('end-round', { round: 2, shuffled: true }), nameOf)).toBe(
			'Round 2 ended. The Fool came out, so both decks were shuffled.'
		);
	});

	it('says when an empty deck was shuffled to make a draw', () => {
		expect(
			describe(ev('move', { from: 'deck:gm', to: 'fate', seat: 's1', reshuffled: true }), nameOf)
		).toMatch(/^The GM deck was empty, so its discard was shuffled back in\. /);
	});

	it('reads hidden Health aloud only to a view that has the numbers', () => {
		const hidden = ev('set-hd', { label: 'Zombie B', creature: 'z:B', stat: 'health' });
		expect(describe(hidden, nameOf)).toBe('Zombie B: Health changed.');
		const gmView = {
			viewer: 'gm',
			upNow: [],
			opponents: [
				{
					creatures: [
						{ id: 'z:B', pools: [{ health: 2, healthMax: 6, defense: 0, defenseMax: 0 }] }
					]
				}
			]
		};
		expect(describe(hidden, nameOf, gmView)).toBe('Zombie B: Health 2 of 6.');
	});

	it('says "your turn" to the acting player only, when the count reaches them', () => {
		const played = ev('play-turn', {
			holder: 's2',
			action: 'Attack',
			mode: 'play',
			step: 'turn',
			count: 7
		});
		expect(describe(played, nameOf, { viewer: 's1', upNow: ['s1'] })).toBe(
			'Aldis: Attack. Initiative 7. Your turn.'
		);
		expect(describe(played, nameOf, { viewer: 's2', upNow: ['s1'] })).toBe(
			'Aldis: Attack. Initiative 7.'
		);
	});

	it('tells the other player on a tied number that it is their turn too (Session 14)', () => {
		// The count stays on the number, so the event carries no step.
		const played = ev('play-turn', { holder: 's2', action: 'Attack', mode: 'play' });
		expect(describe(played, nameOf, { viewer: 's1', upNow: ['s1'] })).toBe(
			'Aldis: Attack. Your turn too, on the same number.'
		);
		expect(describe(played, nameOf, { viewer: 'gm', upNow: ['s1'] })).toBe('Aldis: Attack.');
	});

	it('names every target, or everyone in a zone (phase 33)', () => {
		expect(
			describe(
				ev('play-turn', {
					holder: 's1',
					action: 'Attack',
					mode: 'play',
					targets: ['s2'],
					targetLabels: ['Zombie A']
				}),
				nameOf
			)
		).toBe('Grimwold: Attack at Aldis and Zombie A.');
		expect(
			describe(
				ev('play-out-of-turn', {
					holder: 's1',
					action: 'Tail Whip',
					targets: ['s2'],
					targetLabels: [],
					inZone: 'Middle Tower'
				}),
				nameOf
			)
		).toBe('Out of turn, Grimwold: Tail Whip at everyone in Middle Tower.');
	});

	it('says what an action was for and at whom, and never what card it was', () => {
		expect(
			describe(
				ev('play-turn', { holder: 's1', action: 'Attack', mode: 'play', targetLabel: 'Zombie B' }),
				nameOf
			)
		).toBe('Grimwold: Attack at Zombie B.');
		expect(
			describe(ev('play-turn', { holder: 's1', action: 'Dodge', mode: 'ready' }), nameOf)
		).toBe('Grimwold readied Dodge.');
		expect(describe(ev('declare-minor', { holder: 's1', label: 'Roughhouse' }), nameOf)).toBe(
			'Grimwold put down a minor action: Roughhouse.'
		);
		// There is nothing else it *could* say: the events carry no card.
	});

	it('says when minor actions open and when they turn over', () => {
		expect(
			describe(
				ev('play-turn', { holder: 's1', action: 'Attack', mode: 'play', step: 'minor', count: 4 }),
				nameOf
			)
		).toBe('Grimwold: Attack. Any minor actions?');
		expect(
			describe(ev('pass-minor', { holders: ['s2', 'gm'], step: 'resolve', count: 4 }), nameOf)
		).toBe('Aldis and The GM passed. Everything is face up.');
	});

	suite('moves, in the table’s own terms rather than in zone ids', () => {
		const move = (from: string, to: string, seat = 's1') => ev('move', { from, to, seat });

		it('a card played', () => {
			expect(describe(move('seat:s1:hand', 'seat:s1:played'), nameOf)).toBe(
				'Grimwold played a card.'
			);
		});

		it('an initiative card, credited to whose slot it landed in', () => {
			expect(describe(move('deck:player', 'seat:s2:initiative', 's2'), nameOf)).toBe(
				'Aldis placed an initiative card.'
			);
		});

		it('credits an enemy’s initiative to whoever placed it', () => {
			// An enemy has no seat, so there is no name in the slot to use — and
			// the GM is the one who places them.
			expect(describe(move('deck:gm', 'opponent:imps:initiative', 's2'), nameOf)).toBe(
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
		expect(describe(ev('show-initiative', { holder: 'gone' }), nameOf)).toBe(
			'Someone showed their initiative.'
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
				ev('start-count', { step: 'turn', count: 2 }, 2),
				ev('step-on', { step: 'turn', count: 5 }, 3)
			],
			nameOf
		);
		expect(said).toBe('Initiative 5.');
	});

	it('looks past events that have nothing to say', () => {
		expect(
			announce(
				[ev('step-on', { step: 'turn', count: 9 }, 1), ev('update-opponent', { id: 'x' }, 2)],
				nameOf
			)
		).toBe('Initiative 9.');
	});

	it('says nothing when nothing happened', () => {
		expect(announce([], nameOf)).toBeNull();
		expect(announce([ev('update-opponent', { id: 'x' })], nameOf)).toBeNull();
	});
});

suite('the scene and its creatures', () => {
	it('says who moved where, by name', () => {
		expect(describe(ev('place', { who: 's1', seat: 's1', zone: 'the Arena' }), nameOf)).toBe(
			'Grimwold moves to the Arena.'
		);
		expect(describe(ev('place', { who: 'z:A', label: 'Zombie A', zone: null }), nameOf)).toBe(
			'Zombie A is not placed.'
		);
	});

	it('reads out where HD ended, with its maximum', () => {
		expect(
			describe(ev('set-hd', { label: 'Zombie B', stat: 'health', value: 2, max: 6 }), nameOf)
		).toBe('Zombie B: Health 2 of 6.');
	});

	it('reads a run of HD clicks once, as the last of them', () => {
		const run = [1, 2, 3].map((v, i) =>
			ev('set-hd', { label: 'Skeleton C', stat: 'health', value: 6 - v, max: 6 }, i + 1)
		);
		expect(announce(run, nameOf)).toBe('Skeleton C: Health 3 of 6.');
	});

	it('says who went down, and who arrived', () => {
		expect(
			describe(
				ev('name-creature', { was: 'Zombie A', label: 'Red Cloak (A)', named: true }),
				nameOf
			)
		).toBe('Zombie A is now Red Cloak (A).');
		expect(
			describe(
				ev('name-creature', { was: 'Red Cloak (A)', label: 'Zombie A', named: false }),
				nameOf
			)
		).toBe('Red Cloak (A) is Zombie A again.');
		expect(describe(ev('set-down', { label: 'Zombie B', down: true }), nameOf)).toBe(
			'Zombie B is down.'
		);
		expect(describe(ev('add-creatures', { labels: ['Zombie C', 'Zombie D'] }), nameOf)).toBe(
			'Zombie C and Zombie D joined the fight.'
		);
	});

	it('names the zones of a new scene', () => {
		expect(describe(ev('set-scene-zones', { zones: ['Arena', "King's Pillar"] }), nameOf)).toBe(
			"The zones are Arena and King's Pillar."
		);
	});
});
