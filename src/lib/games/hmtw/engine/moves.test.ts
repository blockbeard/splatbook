import { describe, expect, it } from 'vitest';
import { createTable, type CardTable, type DeckDefinition } from './table';
import { deal, emptyInto, moveCard, reshuffleDeck } from './moves';
import { seededRng } from './shuffle';
import { seatZone } from './zones';

/** A tiny stand-in deck: enough structure to exercise the moves, small enough to read. */
const deck: DeckDefinition = {
	minors: [
		{ id: 'm1', value: 1 },
		{ id: 'm2', value: 2 },
		{ id: 'm3', value: 3 },
		{ id: 'm4', value: 4 }
	],
	majors: [
		{ id: 'fool', value: 0 },
		{ id: 'j1', value: 1 },
		{ id: 'j2', value: 2 }
	],
	decks: [
		{ id: 'player', arcana: 'minor', includesMajors: ['fool'] },
		{ id: 'gm', arcana: 'major', excludesMajors: ['fool'] }
	]
};
const table = (): CardTable => createTable(deck, ['s1', 's2']);
const cards = (t: CardTable, zone: string) => t.zones[zone].cards;

describe('moveCard', () => {
	it('takes the top of a pile when no card is named', () => {
		const t = table();
		const top = cards(t, 'deck:player')[0];
		const res = moveCard(t, { zone: 'deck:player' }, 'discard:player');
		expect(res.ok && res.card).toBe(top);
		expect(res.ok && cards(res.table, 'discard:player')).toEqual([top]);
		expect(res.ok && cards(res.table, 'deck:player')).toHaveLength(4);
	});

	it('puts the card on top of its destination, like a hand would', () => {
		const t = table();
		const first = moveCard(t, { zone: 'deck:player' }, 'discard:player');
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		const second = moveCard(first.table, { zone: 'deck:player' }, 'discard:player');
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(cards(second.table, 'discard:player')[0]).toBe(second.card);
	});

	it('flipping is moving — a hidden pile to a public one needs no separate verb', () => {
		const t = table();
		expect(t.zones['deck:player'].visibility).toBe('hidden');
		const res = moveCard(t, { zone: 'deck:player' }, 'discard:player');
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.table.zones['discard:player'].visibility).toBe('public');
	});

	it('names a card in a public zone — how a High Chant picks from the discard', () => {
		const t = table();
		const dealt = deal(t, 'deck:player', 'discard:player', 3);
		expect(dealt.ok).toBe(true);
		if (!dealt.ok) return;
		const wanted = cards(dealt.table, 'discard:player')[2];
		const res = moveCard(
			dealt.table,
			{ zone: 'discard:player', card: wanted },
			seatZone('s1', 'durable')
		);
		expect(res.ok && res.card).toBe(wanted);
		expect(res.ok && cards(res.table, seatZone('s1', 'durable'))).toEqual([wanted]);
	});

	it('refuses to name a card in a zone whose faces the asker cannot see', () => {
		// The request itself leaks: naming a card in a hidden pile means already
		// knowing what is in it. Same for another seat's hand.
		const t = table();
		const fromDeck = moveCard(t, { zone: 'deck:player', card: 'm1' }, 'discard:player');
		expect(fromDeck).toEqual({ ok: false, reason: 'card-named-in-private-zone' });
		const fromHand = moveCard(t, { zone: seatZone('s1', 'hand'), card: 'm1' }, 'discard:player');
		expect(fromHand).toEqual({ ok: false, reason: 'card-named-in-private-zone' });
	});

	it('reports the impossible plainly', () => {
		const t = table();
		expect(moveCard(t, { zone: 'nope' }, 'discard:player')).toEqual({
			ok: false,
			reason: 'no-such-zone'
		});
		expect(moveCard(t, { zone: 'discard:player' }, 'nope')).toEqual({
			ok: false,
			reason: 'no-such-zone'
		});
		expect(moveCard(t, { zone: 'discard:player' }, 'deck:player')).toEqual({
			ok: false,
			reason: 'empty'
		});
		const dealt = deal(t, 'deck:player', 'discard:player', 1);
		if (!dealt.ok) return;
		expect(moveCard(dealt.table, { zone: 'discard:player', card: 'nope' }, 'deck:player')).toEqual({
			ok: false,
			reason: 'no-such-card'
		});
	});

	it('respects a capped slot', () => {
		const t = table();
		const first = moveCard(t, { zone: 'deck:player' }, seatZone('s1', 'initiative'));
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		// One initiative card per round: a second has nowhere to go.
		expect(moveCard(first.table, { zone: 'deck:player' }, seatZone('s1', 'initiative'))).toEqual({
			ok: false,
			reason: 'full'
		});
	});

	it('has no opinion about whether a move is legal by the rules', () => {
		// Taking a card straight from the deck into another seat's played pile is
		// nonsense at the table and perfectly fine here: the engine is not a referee.
		const t = table();
		const res = moveCard(t, { zone: 'deck:player' }, seatZone('s2', 'played'));
		expect(res.ok).toBe(true);
	});

	it('never mutates the table it was given', () => {
		const t = table();
		const before = cards(t, 'deck:player').length;
		moveCard(t, { zone: 'deck:player' }, 'discard:player');
		expect(cards(t, 'deck:player')).toHaveLength(before);
	});
});

describe('deal', () => {
	it('moves cards from the top, in order', () => {
		const t = table();
		const top3 = cards(t, 'deck:player').slice(0, 3);
		const res = deal(t, 'deck:player', seatZone('s1', 'hand'), 3);
		expect(res.ok && res.cards).toEqual(top3);
		expect(res.ok && cards(res.table, seatZone('s1', 'hand'))).toHaveLength(3);
	});

	it('stops short rather than failing when the pile runs dry', () => {
		// Five cards in this stand-in player deck; ask for eight.
		const res = deal(table(), 'deck:player', seatZone('s1', 'hand'), 8);
		expect(res.ok && res.cards).toHaveLength(5);
		expect(res.ok && cards(res.table, 'deck:player')).toEqual([]);
	});

	it('reports a bad zone rather than dealing part of a hand', () => {
		expect(deal(table(), 'deck:player', 'nope', 2)).toEqual({ ok: false, reason: 'no-such-zone' });
	});
});

describe('reshuffleDeck', () => {
	it('folds the discard back in and empties it', () => {
		const dealt = deal(table(), 'deck:player', 'discard:player', 3);
		if (!dealt.ok) return;
		const t = reshuffleDeck(dealt.table, 'player', seededRng(1));
		expect(cards(t, 'deck:player')).toHaveLength(5);
		expect(cards(t, 'discard:player')).toEqual([]);
	});

	it('is deterministic for a seed', () => {
		const dealt = deal(table(), 'deck:player', 'discard:player', 2);
		if (!dealt.ok) return;
		const a = reshuffleDeck(dealt.table, 'player', seededRng(5));
		const b = reshuffleDeck(dealt.table, 'player', seededRng(5));
		expect(cards(a, 'deck:player')).toEqual(cards(b, 'deck:player'));
	});

	it('leaves the other deck alone', () => {
		const t = reshuffleDeck(table(), 'player', seededRng(1));
		expect(cards(t, 'deck:gm')).toEqual(cards(table(), 'deck:gm'));
	});
});

describe('emptyInto', () => {
	it('moves a whole zone', () => {
		const dealt = deal(table(), 'deck:player', seatZone('s1', 'hand'), 4);
		if (!dealt.ok) return;
		const t = emptyInto(dealt.table, seatZone('s1', 'hand'), 'discard:player');
		expect(cards(t, seatZone('s1', 'hand'))).toEqual([]);
		expect(cards(t, 'discard:player')).toHaveLength(4);
	});

	it('is a no-op for a zone that does not exist', () => {
		const t = table();
		expect(emptyInto(t, 'nope', 'discard:player')).toBe(t);
	});
});
