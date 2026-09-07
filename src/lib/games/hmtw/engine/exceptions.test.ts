import { describe, expect, it } from 'vitest';
import {
	TABLE_SCHEMA_VERSION,
	addOpponent,
	createTable,
	migrateTable,
	setGmSeat,
	type CardTable,
	type DeckDefinition
} from './table';
import { beginRound } from './round';
import {
	beginInterrupt,
	clearExtraTurn,
	clearFacedown,
	endInterrupt,
	placeFacedown,
	playFool,
	revealFacedown,
	skipTurn
} from './exceptions';
import { canSeeFaces, moveCard } from './moves';
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
const dealt = (): CardTable =>
	beginRound(setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm'), {
		playerHand: 4,
		gmHand: 3,
		rng: seededRng(3)
	});
const cards = (t: CardTable, zone: string) => t.zones[zone].cards;

describe('naming a card you are entitled to see', () => {
	it('lets you play a specific card out of your own hand', () => {
		// The thing the Fool's paired play forced: a blanket ban on naming cards
		// in non-public zones would stop a player choosing what to play.
		const t = dealt();
		const mine = cards(t, seatZone('s1', 'hand'))[2];
		const res = moveCard(
			t,
			{ zone: seatZone('s1', 'hand'), card: mine },
			seatZone('s1', 'played'),
			's1'
		);
		expect(res.ok && res.card).toBe(mine);
	});

	it('still refuses someone else’s hand', () => {
		const t = dealt();
		const theirs = cards(t, seatZone('s1', 'hand'))[0];
		expect(
			moveCard(t, { zone: seatZone('s1', 'hand'), card: theirs }, 'discard:player', 's2')
		).toEqual({ ok: false, reason: 'card-named-in-private-zone' });
	});

	it('refuses the draw pile to everyone, the GM included', () => {
		const t = dealt();
		expect(moveCard(t, { zone: 'deck:gm', card: 'j1' }, 'discard:gm', 'gm')).toEqual({
			ok: false,
			reason: 'card-named-in-private-zone'
		});
	});

	it('resolves a gm zone against whoever holds the seat now', () => {
		const t = addOpponent(dealt(), { id: 'imps', name: 'Imps' });
		const zone = t.zones[opponentZone('imps', 'facedown')];
		expect(canSeeFaces(t, zone, 'gm')).toBe(true);
		expect(canSeeFaces(t, zone, 's1')).toBe(false);
		expect(canSeeFaces(setGmSeat(t, 's1'), zone, 's1')).toBe(true);
	});

	it('names nothing private when nobody is speaking', () => {
		// A server-internal call has no actor; the safe default is public only.
		const t = dealt();
		const mine = cards(t, seatZone('s1', 'hand'))[0];
		expect(moveCard(t, { zone: seatZone('s1', 'hand'), card: mine }, 'discard:player')).toEqual({
			ok: false,
			reason: 'card-named-in-private-zone'
		});
	});
});

describe('the facedown slot', () => {
	const place = (
		t: CardTable,
		holder: string,
		label: string,
		position: 'turn' | 'minor' = 'turn'
	) => placeFacedown(t, holder, { zone: seatZone(holder, 'hand') }, { position, label }, holder);

	it('carries a public label and a private value', () => {
		const res = place(dealt(), 's1', 'Riposte');
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const zone = seatZone('s1', 'facedown');
		// The intent is table knowledge...
		expect(res.table.facedown[zone]).toEqual({ position: 'turn', label: 'Riposte' });
		// ...and the value is not.
		expect(res.table.zones[zone].visibility).toBe('owner');
	});

	it('remembers which side of the initiative card it sits on', () => {
		// Above: played on your turn, and gains an attribute when revealed.
		// Below: a minor action, worth its face value alone.
		const turn = place(dealt(), 's1', 'Dodge', 'turn');
		const minor = place(dealt(), 's1', 'Dodge', 'minor');
		expect(turn.ok && turn.table.facedown[seatZone('s1', 'facedown')].position).toBe('turn');
		expect(minor.ok && minor.table.facedown[seatZone('s1', 'facedown')].position).toBe('minor');
	});

	it('replaces rather than refuses, discarding the one it replaced', () => {
		const first = place(dealt(), 's1', 'Dodge');
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		const replaced = cards(first.table, seatZone('s1', 'facedown'))[0];

		const second = place(first.table, 's1', 'Riposte');
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		// One facedown action at a time — and the old card goes to the discard,
		// which is the book's answer rather than an error.
		expect(cards(second.table, seatZone('s1', 'facedown'))).toHaveLength(1);
		expect(cards(second.table, 'discard:player')).toContain(replaced);
		expect(second.table.facedown[seatZone('s1', 'facedown')].label).toBe('Riposte');
	});

	it('is discardable when you change your mind, label and all', () => {
		const placed = place(dealt(), 's1', 'Dodge');
		if (!placed.ok) return;
		const t = clearFacedown(placed.table, 's1');
		expect(cards(t, seatZone('s1', 'facedown'))).toEqual([]);
		expect(t.facedown[seatZone('s1', 'facedown')]).toBeUndefined();
		expect(cards(t, 'discard:player')).toHaveLength(1);
	});

	it('reveals into the played pile and drops the declaration', () => {
		const placed = place(dealt(), 's1', 'Riposte');
		if (!placed.ok) return;
		const card = cards(placed.table, seatZone('s1', 'facedown'))[0];
		const res = revealFacedown(placed.table, 's1');
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(cards(res.table, seatZone('s1', 'played'))).toContain(card);
		expect(res.table.facedown[seatZone('s1', 'facedown')]).toBeUndefined();
	});

	it('works for an opponent too, whose cards the GM sends there', () => {
		const t = addOpponent(dealt(), { id: 'imps', name: 'Imps' });
		const res = placeFacedown(
			t,
			'imps',
			{ zone: seatZone('gm', 'hand') },
			{ position: 'turn', label: 'Attack' },
			'gm'
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(cards(res.table, opponentZone('imps', 'facedown'))).toHaveLength(1);
		// An opponent's discards belong to the GM's pile.
		const cleared = clearFacedown(res.table, 'imps');
		expect(cards(cleared, 'discard:gm')).toHaveLength(1);
	});

	it('reports a holder that is not at the table', () => {
		const t = dealt();
		expect(
			placeFacedown(t, 'nobody', { zone: 'deck:player' }, { position: 'turn', label: 'x' })
		).toEqual({ ok: false, reason: 'no-such-holder' });
		expect(revealFacedown(t, 'nobody')).toEqual({ ok: false, reason: 'no-such-holder' });
	});
});

describe('the Fool', () => {
	it('goes down with a partner in one move, never alone', () => {
		let t = dealt();
		// Put the Fool in a hand deliberately rather than hoping for it.
		const forced = moveCard(t, { zone: 'deck:player' }, seatZone('s1', 'hand'));
		if (!forced.ok) return;
		t = { ...forced.table };
		t.zones[seatZone('s1', 'hand')] = {
			...t.zones[seatZone('s1', 'hand')],
			cards: ['fool', 'm7']
		};

		const res = playFool(t, 's1', 'fool', 'm7', 's1');
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(cards(res.table, seatZone('s1', 'played'))).toEqual(
			expect.arrayContaining(['fool', 'm7'])
		);
		expect(cards(res.table, seatZone('s1', 'hand'))).toEqual([]);
	});

	it('goes first, owes a second turn, and brings no minor actions with it', () => {
		let t = dealt();
		t = { ...t };
		t.zones[seatZone('s1', 'hand')] = {
			...t.zones[seatZone('s1', 'hand')],
			cards: ['fool', 'm7']
		};
		const res = playFool(t, 's1', 'fool', 'm7', 's1');
		if (!res.ok) return;
		// "The Fool always goes first, no matter what" — an interrupt.
		expect(res.table.round.interrupt).toBe('s1');
		// "two turns (but no minor actions)".
		expect(res.table.round.extraTurn).toBe('s1');
		expect(res.table.round.minorActions).toBe(false);
		expect(clearExtraTurn(res.table).round.extraTurn).toBeNull();
	});

	it('will not play half a pair', () => {
		let t = dealt();
		t = { ...t };
		t.zones[seatZone('s1', 'hand')] = { ...t.zones[seatZone('s1', 'hand')], cards: ['fool'] };
		expect(playFool(t, 's1', 'fool', 'm7', 's1')).toEqual({ ok: false, reason: 'no-such-card' });
	});
});

describe('interrupts and skipping', () => {
	it('records who is acting out of turn, generally — not only the Fool', () => {
		// A halfling with a polearm ripostes the charging goblin.
		const t = beginInterrupt(dealt(), 's2');
		expect(t.round.interrupt).toBe('s2');
		expect(endInterrupt(t).round.interrupt).toBeNull();
	});

	it('shuts the minor-action window when a turn is skipped', () => {
		// "If you do not take an action… Nobody takes minor actions." So skipping
		// closes the window rather than merely not opening it.
		const t = dealt();
		const open = { ...t, round: { ...t.round, minorActions: true } };
		expect(skipTurn(open).round.minorActions).toBe(false);
	});
});

describe('migrateTable v3 → v4', () => {
	it('gives an older table no declarations and a quiet round', () => {
		const v3 = {
			schemaVersion: 3,
			seats: ['s1'],
			gmSeat: null,
			opponents: [],
			round: { number: 2, count: 5, minorActions: true, foolDrawn: true },
			foolCards: ['fool'],
			zones: {
				'seat:s1:facedown': {
					id: 'seat:s1:facedown',
					owner: 's1',
					visibility: 'owner',
					capacity: 1,
					cards: ['m3']
				}
			}
		} as unknown as CardTable;

		const migrated = migrateTable(v3);
		expect(migrated.schemaVersion).toBe(TABLE_SCHEMA_VERSION);
		expect(migrated.facedown).toEqual({});
		expect(migrated.round.interrupt).toBeNull();
		expect(migrated.round.extraTurn).toBeNull();
		// The round it was in the middle of survives intact.
		expect(migrated.round.number).toBe(2);
		expect(migrated.round.count).toBe(5);
		expect(migrated.round.foolDrawn).toBe(true);
		// And so does the card already lying facedown — it simply has no label,
		// which is the honest state of a card played before labels existed.
		expect(migrated.zones['seat:s1:facedown'].cards).toEqual(['m3']);
	});
});
