/**
 * The invariant every other test assumed and none of them checked: cards are
 * conserved. Seventy-eight go in, seventy-eight stay in, whatever anyone does.
 *
 * Its absence is how a duplication bug survived six commits — moving a card
 * into the zone it already sat in produced two of it, because the two zone
 * assignments collided on one key. Nothing else noticed, because every other
 * test asked about one zone at a time.
 */

import { describe, expect, it } from 'vitest';
import { addOpponent, createTable, setGmSeat, type CardTable, type DeckDefinition } from './table';
import { beginRound, endRound, mulliganGmHand } from './round';
import { clearFacedown, placeFacedown, revealFacedown } from './exceptions';
import { deal, emptyInto, moveCard, reshuffleDeck } from './moves';
import { seededRng } from './shuffle';
import { opponentZone, seatZone } from './zones';

const deck: DeckDefinition = {
	minors: Array.from({ length: 20 }, (_, i) => ({ id: `m${i + 1}` })),
	majors: [{ id: 'fool' }, ...Array.from({ length: 10 }, (_, i) => ({ id: `j${i + 1}` }))],
	decks: [
		{ id: 'player', arcana: 'minor', includesMajors: ['fool'] },
		{ id: 'gm', arcana: 'major', excludesMajors: ['fool'] }
	]
};
const TOTAL = 31;

const all = (t: CardTable) => Object.values(t.zones).flatMap((z) => z.cards);
const conserved = (t: CardTable) => {
	const cards = all(t);
	expect(cards).toHaveLength(TOTAL);
	expect(new Set(cards).size).toBe(TOTAL); // no duplicates, no losses
};

describe('cards are conserved', () => {
	it('by a fresh table', () => {
		conserved(createTable(deck, ['s1', 's2', 'gm']));
	});

	it('by moving a card into the zone it is already in', () => {
		// The regression. A card brought to the top of its own pile is a reorder,
		// not a second card.
		const t = createTable(deck, ['s1']);
		const res = moveCard(t, { zone: 'deck:player' }, 'deck:player');
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		conserved(res.table);
		expect(res.table.zones['deck:player'].cards[0]).toBe(res.card);
	});

	it('by a named card brought to the top of a public pile', () => {
		let t = createTable(deck, ['s1']);
		const dealt = deal(t, 'deck:player', 'discard:player', 5);
		if (!dealt.ok) return;
		t = dealt.table;
		const wanted = t.zones['discard:player'].cards[3];
		const res = moveCard(t, { zone: 'discard:player', card: wanted }, 'discard:player');
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		conserved(res.table);
		expect(res.table.zones['discard:player'].cards[0]).toBe(wanted);
	});

	it('by a whole round, played out', () => {
		let t = setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm');
		t = addOpponent(t, { id: 'imps', name: 'Imps', count: 6 });
		conserved(t);

		t = beginRound(t, { playerHand: 4, gmHand: 3, rng: seededRng(9) });
		conserved(t);

		t = mulliganGmHand(t, seededRng(4));
		conserved(t);

		const init = moveCard(t, { zone: seatZone('s1', 'hand') }, seatZone('s1', 'initiative'), 's1');
		if (init.ok) t = init.table;
		conserved(t);

		const face = placeFacedown(
			t,
			's2',
			{ zone: seatZone('s2', 'hand') },
			{ position: 'turn', label: 'Dodge' },
			's2'
		);
		if (face.ok) t = face.table;
		conserved(t);

		// Replacing a facedown card discards the old one — a place cards can go
		// missing if the replacement is done carelessly.
		const replaced = placeFacedown(
			t,
			's2',
			{ zone: seatZone('s2', 'hand') },
			{ position: 'minor', label: 'Riposte' },
			's2'
		);
		if (replaced.ok) t = replaced.table;
		conserved(t);

		const revealed = revealFacedown(t, 's2');
		if (revealed.ok) t = revealed.table;
		conserved(t);

		const enemy = placeFacedown(
			t,
			'imps',
			{ zone: seatZone('gm', 'hand') },
			{ position: 'turn', label: 'Attack' },
			'gm'
		);
		if (enemy.ok) t = enemy.table;
		conserved(t);

		t = clearFacedown(t, 'imps');
		conserved(t);

		t = emptyInto(t, seatZone('s1', 'played'), 'discard:player');
		conserved(t);

		t = endRound(t, seededRng(2));
		conserved(t);

		t = reshuffleDeck(t, 'player', seededRng(1));
		t = reshuffleDeck(t, 'gm', seededRng(1));
		conserved(t);
	});

	it('by dealing more than a pile holds', () => {
		const t = createTable(deck, ['s1']);
		const res = deal(t, 'deck:player', seatZone('s1', 'hand'), 999);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		conserved(res.table);
	});

	it('by a refusal, which must change nothing at all', () => {
		const t = beginRound(setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm'), {
			playerHand: 4,
			gmHand: 3,
			rng: seededRng(1)
		});
		const before = JSON.stringify(t);
		moveCard(t, { zone: seatZone('s1', 'hand') }, 'discard:player', 's2');
		moveCard(t, { zone: 'nowhere' }, 'discard:player');
		moveCard(t, { zone: 'deck:player', card: 'm1' }, 'discard:player', 's1');
		expect(JSON.stringify(t)).toBe(before);
	});
});

describe('reach is not the same question as sight', () => {
	it('lets any seat flip the initiative of a player who has wandered off', () => {
		// The AFK case, which is why reach is permissive everywhere but a hand.
		let t = beginRound(setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm'), {
			playerHand: 4,
			gmHand: 0,
			rng: seededRng(1)
		});
		const placed = moveCard(
			t,
			{ zone: seatZone('s1', 'hand') },
			seatZone('s1', 'initiative'),
			's1'
		);
		if (!placed.ok) return;
		t = placed.table;

		// s2 cannot see it — and can still turn it over, which is the point.
		expect(t.zones[seatZone('s1', 'initiative')].visibility).toBe('owner');
		const flipped = moveCard(
			t,
			{ zone: seatZone('s1', 'initiative') },
			seatZone('s1', 'played'),
			's2'
		);
		expect(flipped.ok).toBe(true);
	});

	it('lets anyone move an opponent’s facedown card, which only the GM can read', () => {
		let t = addOpponent(setGmSeat(createTable(deck, ['s1', 'gm']), 'gm'), {
			id: 'imps',
			name: 'Imps'
		});
		const placed = moveCard(t, { zone: 'deck:gm' }, opponentZone('imps', 'facedown'));
		if (!placed.ok) return;
		t = placed.table;
		const moved = moveCard(t, { zone: opponentZone('imps', 'facedown') }, 'discard:gm', 's1');
		expect(moved.ok).toBe(true);
	});

	it('still keeps every hand to its owner', () => {
		const t = beginRound(setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm'), {
			playerHand: 4,
			gmHand: 3,
			rng: seededRng(1)
		});
		for (const [holder, thief] of [
			['s1', 's2'],
			['gm', 's1'],
			['s2', 'gm']
		]) {
			expect(moveCard(t, { zone: seatZone(holder, 'hand') }, 'discard:player', thief)).toEqual({
				ok: false,
				reason: 'not-your-hand'
			});
		}
	});

	it('lets the server itself clear a hand, since a sweep has no asker', () => {
		const t = beginRound(setGmSeat(createTable(deck, ['s1', 'gm']), 'gm'), {
			playerHand: 4,
			gmHand: 0,
			rng: seededRng(1)
		});
		const swept = emptyInto(t, seatZone('s1', 'hand'), 'discard:player');
		expect(swept.zones[seatZone('s1', 'hand')].cards).toEqual([]);
		conserved(swept);
	});
});

describe('a shuffle only takes back its own cards', () => {
	/** A table that knows which deck each card belongs to, as a real one does. */
	const known = (): CardTable => {
		const t = createTable(deck, ['s1']);
		return {
			...t,
			deckOf: {
				...Object.fromEntries(deck.minors.map((c) => [c.id, 'player' as const])),
				...Object.fromEntries(deck.majors.map((c) => [c.id, 'gm' as const])),
				fool: 'player' as const
			}
		};
	};

	it('leaves a stray out of the deck it does not belong to', () => {
		// The table lets you drop a card on the wrong pile, because a physical one
		// does. What it must not do is bury it in the wrong deck, where nobody can
		// find it and every later draw is wrong.
		let t = known();
		const moved = moveCard(t, { zone: 'deck:player' }, 'discard:gm');
		expect(moved.ok).toBe(true);
		if (!moved.ok) return;
		t = moved.table;
		const stray = moved.card;

		t = reshuffleDeck(t, 'gm', seededRng(1));
		expect(t.zones['deck:gm'].cards).not.toContain(stray);
		// And it is somewhere a person can see it: its own discard.
		expect(t.zones['discard:player'].cards).toContain(stray);
		conserved(t);
	});

	it('sends the stray home, so the next shuffle puts it back properly', () => {
		let t = known();
		const moved = moveCard(t, { zone: 'deck:player' }, 'discard:gm');
		if (!moved.ok) return;
		t = reshuffleDeck(moved.table, 'gm', seededRng(1));
		t = reshuffleDeck(t, 'player', seededRng(1));
		expect(t.zones['deck:player'].cards).toContain(moved.card);
		conserved(t);
	});

	it('still gathers its own discard, which is the point of shuffling', () => {
		let t = known();
		const dealt = deal(t, 'deck:player', 'discard:player', 4);
		if (!dealt.ok) return;
		t = reshuffleDeck(dealt.table, 'player', seededRng(1));
		expect(t.zones['discard:player'].cards).toEqual([]);
		expect(t.zones['deck:player'].cards).toHaveLength(21);
		conserved(t);
	});

	it('does nothing surprising when it has no membership to go on', () => {
		// An old blob has no `deckOf` until the pack reseeds it. Until then a
		// shuffle behaves as it always did rather than throwing cards away.
		let t = createTable(deck, ['s1']);
		const dealt = deal(t, 'deck:player', 'discard:player', 3);
		if (!dealt.ok) return;
		t = reshuffleDeck(dealt.table, 'player', seededRng(1));
		expect(t.zones['discard:player'].cards).toEqual([]);
		conserved(t);
	});
});
