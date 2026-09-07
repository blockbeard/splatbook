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
import {
	advanceCount,
	beginRound,
	endRound,
	mulliganGmHand,
	rewindCount,
	setCount,
	setMinorActions,
	suggestGmHandSize
} from './round';
import { moveCard } from './moves';
import { seededRng } from './shuffle';
import { opponentZone, seatZone } from './zones';

const deck: DeckDefinition = {
	minors: Array.from({ length: 24 }, (_, i) => ({ id: `m${i + 1}` })),
	majors: [{ id: 'fool' }, ...Array.from({ length: 12 }, (_, i) => ({ id: `j${i + 1}` }))],
	decks: [
		{ id: 'player', arcana: 'minor', includesMajors: ['fool'] },
		{ id: 'gm', arcana: 'major', excludesMajors: ['fool'] }
	]
};
/** s1 and s2 play; gm runs it. */
const table = (): CardTable => setGmSeat(createTable(deck, ['s1', 's2', 'gm']), 'gm');
const rng = () => seededRng(11);
const cards = (t: CardTable, zone: string) => t.zones[zone].cards;

/** The GM's list from ch.7, as `data/challenge.json` carries it. */
const gmConfig = {
	base: 3,
	modifiers: [
		{ id: 'enemy-type', amount: 1, kind: 'count' as const },
		{ id: 'outnumber', amount: 1, kind: 'toggle' as const },
		{ id: 'double', amount: 1, kind: 'toggle' as const },
		{ id: 'larger-than-human', amount: 1, kind: 'count' as const },
		{ id: 'elite', amount: 2, kind: 'toggle' as const },
		{ id: 'dungeon-lord', amount: 3, kind: 'toggle' as const }
	]
};

describe('suggestGmHandSize', () => {
	it('draws the book’s own worked example: twelve imps against four adventurers', () => {
		// "the GM draws 6 cards … 3 to start, +1 for the one type of enemy (imps),
		// +1 for having more enemies than adventurers, +1 for having twice as many"
		expect(suggestGmHandSize(gmConfig, { 'enemy-type': 1, outnumber: true, double: true })).toBe(6);
	});

	it('draws fewer as the imps die, which is the point of rechecking each round', () => {
		// "reduce the number of imps to seven … 3 + 1 + 1"
		expect(suggestGmHandSize(gmConfig, { 'enemy-type': 1, outnumber: true })).toBe(5);
	});

	it('counts a second enemy type once more — the pendulum blade example', () => {
		// The GM treats the blade as its own enemy: 3 + 2 + 1 + 1 = 7.
		expect(suggestGmHandSize(gmConfig, { 'enemy-type': 2, outnumber: true, double: true })).toBe(7);
	});

	it('adds the big ones cumulatively, and the named threats at their own weight', () => {
		expect(suggestGmHandSize(gmConfig, { 'larger-than-human': 3 })).toBe(6);
		expect(suggestGmHandSize(gmConfig, { elite: true })).toBe(5);
		expect(suggestGmHandSize(gmConfig, { 'dungeon-lord': true })).toBe(6);
	});

	it('is the base when nothing applies, and ignores nonsense', () => {
		expect(suggestGmHandSize(gmConfig, {})).toBe(3);
		expect(suggestGmHandSize(gmConfig, { outnumber: false, 'enemy-type': 0 })).toBe(3);
		expect(suggestGmHandSize(gmConfig, { 'enemy-type': -4 })).toBe(3);
		expect(suggestGmHandSize(gmConfig, { 'no-such-modifier': true })).toBe(3);
	});
});

describe('beginRound', () => {
	it('deals four to each player and the GM’s own number, from the right decks', () => {
		const t = beginRound(table(), { playerHand: 4, gmHand: 6, rng: rng() });
		expect(cards(t, seatZone('s1', 'hand'))).toHaveLength(4);
		expect(cards(t, seatZone('s2', 'hand'))).toHaveLength(4);
		expect(cards(t, seatZone('gm', 'hand'))).toHaveLength(6);
		// Players from the minors, the GM from the majors.
		for (const card of cards(t, seatZone('s1', 'hand'))) expect(card.startsWith('m')).toBe(true);
		for (const card of cards(t, seatZone('gm', 'hand'))) expect(card.startsWith('j')).toBe(true);
	});

	it('counts rounds up from one', () => {
		let t = beginRound(table(), { playerHand: 4, gmHand: 3, rng: rng() });
		expect(t.round.number).toBe(1);
		t = beginRound(t, { playerHand: 4, gmHand: 3, rng: rng() });
		expect(t.round.number).toBe(2);
	});

	it('starts each round with nobody counting and the minor-action window shut', () => {
		const started = setMinorActions(setCount(table(), 9), true);
		const t = beginRound(started, { playerHand: 4, gmHand: 3, rng: rng() });
		expect(t.round.count).toBeNull();
		expect(t.round.minorActions).toBe(false);
	});

	it('remembers that the Fool came out', () => {
		// The Fool sits in the player deck; deal the whole thing and it must appear.
		const t = beginRound(table(), { playerHand: 13, gmHand: 0, rng: rng() });
		expect(t.round.foolDrawn).toBe(true);
	});

	it('does not claim the Fool when it is still in the deck', () => {
		const t = beginRound(table(), { playerHand: 2, gmHand: 2, rng: rng() });
		const dealt = [...cards(t, seatZone('s1', 'hand')), ...cards(t, seatZone('s2', 'hand'))];
		expect(t.round.foolDrawn).toBe(dealt.includes('fool'));
	});

	it('reshuffles the discard back in when a pile runs dry mid-deal', () => {
		// Bury most of the player deck in its discard, then ask for a full hand.
		let t = table();
		for (let i = 0; i < 22; i++) {
			const moved = moveCard(t, { zone: 'deck:player' }, 'discard:player');
			if (moved.ok) t = moved.table;
		}
		expect(cards(t, 'deck:player')).toHaveLength(3);
		const dealt = beginRound(t, { playerHand: 4, gmHand: 0, rng: rng() });
		// Both players still got four: the discard came back.
		expect(cards(dealt, seatZone('s1', 'hand'))).toHaveLength(4);
		expect(cards(dealt, seatZone('s2', 'hand'))).toHaveLength(4);
	});

	it('deals to the players when nobody is running the game', () => {
		const t = beginRound(createTable(deck, ['s1']), { playerHand: 4, gmHand: 6, rng: rng() });
		expect(cards(t, seatZone('s1', 'hand'))).toHaveLength(4);
	});
});

describe('mulliganGmHand', () => {
	it('discards the hand and draws the same number again', () => {
		const t = beginRound(table(), { playerHand: 0, gmHand: 5, rng: rng() });
		const before = [...cards(t, seatZone('gm', 'hand'))];
		const after = mulliganGmHand(t, seededRng(77));
		expect(cards(after, seatZone('gm', 'hand'))).toHaveLength(5);
		expect(cards(after, 'discard:gm')).toEqual(expect.arrayContaining(before));
	});

	it('does nothing without a GM, or with an empty hand', () => {
		const noGm = createTable(deck, ['s1']);
		expect(mulliganGmHand(noGm, seededRng(1))).toBe(noGm);
		const t = table();
		expect(mulliganGmHand(t, seededRng(1))).toBe(t);
	});
});

describe('the count', () => {
	it('starts at the ace and goes up', () => {
		let t = advanceCount(table());
		expect(t.round.count).toBe(1);
		t = advanceCount(t);
		expect(t.round.count).toBe(2);
	});

	it('is not capped at the king, because the GM plays majors for initiative', () => {
		// A greater doom initiative sits at 15–21 and still has to be called.
		const t = setCount(table(), 17);
		expect(advanceCount(t).round.count).toBe(18);
	});

	it('rewinds for a number called too soon, but never below the ace', () => {
		expect(rewindCount(setCount(table(), 5)).round.count).toBe(4);
		expect(rewindCount(setCount(table(), 1)).round.count).toBe(1);
		expect(rewindCount(table()).round.count).toBeNull();
	});

	it('opens and shuts the minor-action window', () => {
		expect(setMinorActions(table(), true).round.minorActions).toBe(true);
		expect(setMinorActions(setMinorActions(table(), true), false).round.minorActions).toBe(false);
	});
});

describe('endRound', () => {
	const played = (t: CardTable, seat: string, kind: 'initiative' | 'facedown') => {
		const moved = moveCard(t, { zone: seatZone(seat, 'hand') }, seatZone(seat, kind));
		return moved.ok ? moved.table : t;
	};

	it('discards unused hands and initiative cards to the right piles', () => {
		let t = beginRound(table(), { playerHand: 4, gmHand: 3, rng: rng() });
		t = played(t, 's1', 'initiative');
		t = endRound(t, rng());
		expect(cards(t, seatZone('s1', 'hand'))).toEqual([]);
		expect(cards(t, seatZone('s1', 'initiative'))).toEqual([]);
		expect(cards(t, seatZone('gm', 'hand'))).toEqual([]);
		// A player's cards go to the player discard; the GM's to theirs.
		expect(cards(t, 'discard:player')).toHaveLength(8);
		expect(cards(t, 'discard:gm')).toHaveLength(3);
	});

	it('leaves facedown cards in play — the rule an earlier draft had wrong', () => {
		let t = beginRound(table(), { playerHand: 4, gmHand: 0, rng: rng() });
		t = played(t, 's1', 'facedown');
		const readied = cards(t, seatZone('s1', 'facedown'))[0];
		t = endRound(t, rng());
		// A readied Dodge survives into the next round; that is what it is for.
		expect(cards(t, seatZone('s1', 'facedown'))).toEqual([readied]);
	});

	it('clears an opponent’s initiative but not what it played facedown', () => {
		let t = addOpponent(beginRound(table(), { playerHand: 0, gmHand: 4, rng: rng() }), {
			id: 'imps',
			name: 'Imps'
		});
		const init = moveCard(t, { zone: seatZone('gm', 'hand') }, opponentZone('imps', 'initiative'));
		if (init.ok) t = init.table;
		const face = moveCard(t, { zone: seatZone('gm', 'hand') }, opponentZone('imps', 'facedown'));
		if (face.ok) t = face.table;

		t = endRound(t, rng());
		expect(cards(t, opponentZone('imps', 'initiative'))).toEqual([]);
		expect(cards(t, opponentZone('imps', 'facedown'))).toHaveLength(1);
	});

	it('shuffles both decks when the Fool was drawn, and spends the flag', () => {
		let t = beginRound(table(), { playerHand: 13, gmHand: 0, rng: rng() });
		expect(t.round.foolDrawn).toBe(true);
		const gmBefore = [...cards(t, 'deck:gm')];
		t = endRound(t, rng());
		// "shuffle both the minor and major arcana decks" — the major deck too,
		// even though nobody drew from it.
		expect(cards(t, 'deck:gm')).not.toEqual(gmBefore);
		expect(cards(t, 'discard:player')).toEqual([]);
		expect(t.round.foolDrawn).toBe(false);
	});

	it('leaves the decks alone when the Fool stayed put', () => {
		// createTable does not shuffle, so this deal is exactly the top of the pack
		// order and the Fool — last in the player deck — stays put. Asserted rather
		// than assumed, so the test cannot quietly stop testing anything.
		let t = beginRound(table(), { playerHand: 2, gmHand: 2, rng: rng() });
		expect(t.round.foolDrawn).toBe(false);
		const gmBefore = [...cards(t, 'deck:gm')];
		t = endRound(t, rng());
		expect(cards(t, 'deck:gm')).toEqual(gmBefore);
		expect(cards(t, 'discard:player')).toHaveLength(4);
	});

	it('stops the count and shuts the window', () => {
		let t = setMinorActions(
			setCount(beginRound(table(), { playerHand: 4, gmHand: 3, rng: rng() }), 7),
			true
		);
		t = endRound(t, rng());
		expect(t.round.count).toBeNull();
		expect(t.round.minorActions).toBe(false);
	});
});

describe('migrateTable v2 → v3', () => {
	it('gives a table that predates the round an unstarted one', () => {
		const v2 = {
			schemaVersion: 2,
			seats: ['s1'],
			gmSeat: null,
			opponents: [{ id: 'imps', name: 'Imps', count: 3 }],
			zones: {
				'deck:player': {
					id: 'deck:player',
					owner: null,
					visibility: 'hidden',
					capacity: null,
					cards: ['m1']
				}
			}
		} as unknown as CardTable;

		const migrated = migrateTable(v2);
		expect(migrated.schemaVersion).toBe(TABLE_SCHEMA_VERSION);
		expect(migrated.round).toEqual({
			number: 0,
			count: null,
			minorActions: false,
			foolDrawn: false
		});
		// The deck definition is not in an old blob, so this cannot be recovered
		// here; the caller reseeds it from the pack.
		expect(migrated.foolCards).toEqual([]);
		expect(migrated.opponents).toHaveLength(1);
		expect(migrated.zones['deck:player'].cards).toEqual(['m1']);
	});

	it('leaves a live round alone', () => {
		const t = setCount(beginRound(table(), { playerHand: 4, gmHand: 3, rng: rng() }), 4);
		const migrated = migrateTable(t);
		expect(migrated.round.number).toBe(1);
		expect(migrated.round.count).toBe(4);
		expect(migrated.foolCards).toEqual(['fool']);
	});
});
