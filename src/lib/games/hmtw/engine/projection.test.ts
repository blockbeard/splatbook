/**
 * Leak tests.
 *
 * The load-bearing one is `never carries a card the viewer is not entitled to`:
 * it serialises a whole projection and searches it for every hidden card,
 * rather than checking the fields we happen to have thought of. A leak through
 * some field added later fails it without anyone remembering to look.
 */

import { describe, expect, it } from 'vitest';
import { createTable, addOpponent, setGmSeat, type CardTable, type DeckDefinition } from './table';
import { beginRound } from './round';
import { placeFacedown } from './exceptions';
import { hiddenFrom, projectFor, whoIsUp } from './projection';
import { moveCard } from './moves';
import { seededRng } from './shuffle';
import { opponentZone, seatZone } from './zones';

const deck: DeckDefinition = {
	minors: Array.from({ length: 20 }, (_, i) => ({ id: `m${i + 1}`, value: i + 1 })),
	majors: [
		{ id: 'fool', value: 0 },
		...Array.from({ length: 10 }, (_, i) => ({ id: `j${i + 1}`, value: i + 1 }))
	],
	decks: [
		{ id: 'player', arcana: 'minor', includesMajors: ['fool'] },
		{ id: 'gm', arcana: 'major', excludesMajors: ['fool'] }
	]
};

/** A table mid-fight: hands dealt, an enemy, a facedown card, a card played. */
function inPlay(): CardTable {
	let t = beginRound(setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm'), {
		playerHand: 4,
		gmHand: 3,
		rng: seededRng(5)
	});
	t = addOpponent(t, { id: 'imps', name: 'Imps', count: 6 });

	const initiative = moveCard(t, { zone: seatZone('s1', 'hand') }, seatZone('s1', 'initiative'));
	if (initiative.ok) t = initiative.table;

	const facedown = placeFacedown(
		t,
		's2',
		{ zone: seatZone('s2', 'hand') },
		{ position: 'turn', label: 'Riposte' },
		's2'
	);
	if (facedown.ok) t = facedown.table;

	const enemy = placeFacedown(
		t,
		'imps',
		{ zone: seatZone('gm', 'hand') },
		{ position: 'turn', label: 'Attack' },
		'gm'
	);
	if (enemy.ok) t = enemy.table;

	const played = moveCard(t, { zone: seatZone('s1', 'hand') }, seatZone('s1', 'played'), 's1');
	if (played.ok) t = played.table;
	return t;
}

describe('a projection never carries a card the viewer is not entitled to', () => {
	for (const viewer of ['s1', 's2', 'gm', undefined]) {
		it(`holds up for ${viewer ?? 'a stranger'}`, () => {
			const table = inPlay();
			const serialised = JSON.stringify(projectFor(table, viewer));
			const hidden = hiddenFrom(table, viewer);

			expect(hidden.length).toBeGreaterThan(0); // the test would be vacuous otherwise
			for (const card of hidden) {
				// Whole-word match: `m1` must not match inside `m12`.
				expect(new RegExp(`"${card}"`).test(serialised)).toBe(false);
			}
		});
	}
});

describe('what each seat sees', () => {
	it('gives you your own hand and only a count of everyone else’s', () => {
		const table = inPlay();
		const mine = projectFor(table, 's1');
		expect(mine.zones[seatZone('s1', 'hand')].cards).toBeDefined();
		const theirs = mine.zones[seatZone('s2', 'hand')];
		expect(theirs.cards).toBeUndefined();
		// The count is not a secret: everyone can see how many cards you hold.
		expect(theirs.count).toBe(table.zones[seatZone('s2', 'hand')].cards.length);
	});

	it('keeps the draw piles shut to everyone, the GM included', () => {
		const table = inPlay();
		for (const viewer of ['s1', 'gm']) {
			const view = projectFor(table, viewer);
			expect(view.zones['deck:player'].cards).toBeUndefined();
			expect(view.zones['deck:gm'].cards).toBeUndefined();
			expect(view.zones['deck:gm'].count).toBeGreaterThan(0);
		}
	});

	it('shows the discards and played cards to everybody', () => {
		const table = inPlay();
		for (const viewer of ['s1', 's2', 'gm', undefined]) {
			const view = projectFor(table, viewer);
			expect(view.zones['discard:player'].cards).toBeDefined();
			expect(view.zones[seatZone('s1', 'played')].cards).toBeDefined();
		}
	});

	it('hides your initiative card from the table until it turns over', () => {
		const table = inPlay();
		expect(projectFor(table, 's1').zones[seatZone('s1', 'initiative')].cards).toBeDefined();
		expect(projectFor(table, 's2').zones[seatZone('s1', 'initiative')].cards).toBeUndefined();
	});

	it('shows an opponent’s facedown card to the GM alone', () => {
		const table = inPlay();
		const zone = opponentZone('imps', 'facedown');
		expect(projectFor(table, 'gm').zones[zone].cards).toBeDefined();
		expect(projectFor(table, 's1').zones[zone].cards).toBeUndefined();
	});

	it('follows the GM seat when it changes hands', () => {
		const table = inPlay();
		const zone = opponentZone('imps', 'facedown');
		expect(projectFor(setGmSeat(table, 's1'), 's1').zones[zone].cards).toBeDefined();
		expect(projectFor(setGmSeat(table, 's1'), 'gm').zones[zone].cards).toBeUndefined();
	});
});

describe('what stays public on purpose', () => {
	it('tells everyone what a facedown card is *for*, while hiding what it is', () => {
		const table = inPlay();
		const view = projectFor(table, 's1');
		// Ch.7: the player states the action; only they know the value.
		expect(view.facedown[seatZone('s2', 'facedown')]).toEqual({
			position: 'turn',
			label: 'Riposte'
		});
		expect(view.zones[seatZone('s2', 'facedown')].cards).toBeUndefined();
	});

	it('tells the table the Fool is in play, but not whose hand it is in', () => {
		// The reshuffle is required at the end of the round, and one nobody knows
		// to perform is worse than a hand that is slightly less secret. Which hand
		// holds it — the part that would change how anyone plays — stays hidden.
		let t = setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm');
		t = beginRound(t, { playerHand: 13, gmHand: 0, rng: seededRng(5) });
		expect(t.round.foolDrawn).toBe(true);

		// The deck is unshuffled, so this deal is exact: s1 takes m1-m13 and s2
		// takes the rest, the Fool among them. So ask s1, who does not hold it —
		// asking s2 would only prove that you can see your own hand.
		expect(t.zones[seatZone('s2', 'hand')].cards).toContain('fool');
		const view = projectFor(t, 's1');
		expect(view.round.foolDrawn).toBe(true);
		expect(JSON.stringify(view).includes('"fool"')).toBe(false);
	});

	it('shows the roster, the count and whose turn it is', () => {
		const table = inPlay();
		const view = projectFor(table, 's1');
		expect(view.opponents).toEqual([{ id: 'imps', name: 'Imps', count: 6 }]);
		expect(view.seats).toEqual(['s1', 's2', 'gm']);
		expect(view.gmSeat).toBe('gm');
		expect(view.round.number).toBe(1);
	});

	it('carries every public field a client needs to render, not just the zones', () => {
		// The failure this catches: `mode` was added to the table's state and not
		// to the projection, so a command switched the view and no client ever
		// saw it. Nothing type-checked it, because a projection is a different
		// shape from the state it comes from.
		const view = projectFor(inPlay(), 's1');
		for (const key of ['mode', 'seats', 'gmSeat', 'opponents', 'round', 'facedown', 'zones']) {
			expect(view).toHaveProperty(key);
		}
	});

	it('says whose view it is', () => {
		expect(projectFor(inPlay(), 's1').viewer).toBe('s1');
		expect(projectFor(inPlay()).viewer).toBeNull();
	});
});

describe('projection is a copy, not a window', () => {
	it('cannot be edited into the table', () => {
		const table = inPlay();
		const view = projectFor(table, 's1');
		view.zones[seatZone('s1', 'hand')].cards?.push('m99');
		view.opponents[0].name = 'Not imps';
		expect(table.zones[seatZone('s1', 'hand')].cards).not.toContain('m99');
		expect(table.opponents[0].name).toBe('Imps');
	});
});

describe('who the count has reached', () => {
	/** A round with initiative down: s1 on 3, s2 on 7, the imps on 3. */
	function counting(count: number | null): CardTable {
		let t = addOpponent(setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm'), {
			id: 'imps',
			name: 'Imps'
		});
		t = {
			...t,
			valueOf: { m3: 3, m7: 7, j3: 3 },
			round: { ...t.round, count },
			zones: {
				...t.zones,
				'seat:s1:initiative': { ...t.zones['seat:s1:initiative'], cards: ['m3'] },
				'seat:s2:initiative': { ...t.zones['seat:s2:initiative'], cards: ['m7'] },
				'opponent:imps:initiative': { ...t.zones['opponent:imps:initiative'], cards: ['j3'] }
			}
		};
		return t;
	}

	it('names whoever holds the number being called, players and enemies alike', () => {
		expect(whoIsUp(counting(3)).sort()).toEqual(['imps', 's1']);
		expect(whoIsUp(counting(7))).toEqual(['s2']);
		expect(whoIsUp(counting(5))).toEqual([]);
	});

	it('says nothing at all before anyone is counting', () => {
		// The one rule guided mode must not break: a prompt may not run ahead of
		// the call. With no count there is nothing to disclose, and it discloses
		// nothing.
		expect(whoIsUp(counting(null))).toEqual([]);
		expect(projectFor(counting(null), 's1').upNow).toEqual([]);
	});

	it('tells everyone the same thing, because the count is said out loud', () => {
		const table = counting(3);
		for (const viewer of ['s1', 's2', 'gm', undefined]) {
			expect(projectFor(table, viewer).upNow.sort()).toEqual(['imps', 's1']);
		}
	});

	it('still never sends the card itself', () => {
		// Saying "s1 is up" is what the GM calling four does. Saying *which card*
		// is not, and the leak test above covers every viewpoint.
		const view = JSON.stringify(projectFor(counting(3), 's2'));
		expect(view).not.toContain('"m3"');
		expect(view).toContain('s1');
	});
});
