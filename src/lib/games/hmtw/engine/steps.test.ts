/**
 * The round in steps (phase 32): whole rounds, played the way the first live
 * test's table should have played them.
 */

import { describe, expect, it } from 'vitest';
import {
	TABLE_SCHEMA_VERSION,
	addOpponent,
	createTable,
	migrateTable,
	setGmSeat,
	type CardTable
} from './table';
import type { DeckDefinition } from './table';
import { beginRound, endRound } from './round';
import { seededRng } from './shuffle';
import { opponentZone, seatZone } from './zones';
import { projectFor } from './projection';
import {
	declareMinor,
	discardFor,
	expectedMinor,
	nextNumber,
	passMinor,
	playInitiative,
	playOutOfTurn,
	playTurn,
	readyMinor,
	resolveNumber,
	skipTurn,
	startCount,
	stepOn,
	takeBack,
	upAt,
	useReadied,
	waitingForInitiative,
	type StepResult
} from './steps';

const deck: DeckDefinition = {
	minors: Array.from({ length: 24 }, (_, i) => ({ id: `m${i + 1}`, value: (i % 14) + 1 })),
	majors: [
		{ id: 'fool', value: 0 },
		...Array.from({ length: 12 }, (_, i) => ({ id: `j${i + 1}`, value: i + 1 }))
	],
	decks: [
		{ id: 'player', arcana: 'minor', includesMajors: ['fool'] },
		{ id: 'gm', arcana: 'major', excludesMajors: ['fool'] }
	]
};

const ok = (r: StepResult): CardTable => {
	if (!r.ok) throw new Error(r.reason);
	return r.table;
};

/** Ash and Bel against three zombies; the deck unshuffled, so every deal is exact. */
function dealt(): CardTable {
	let t = setGmSeat(createTable(deck, ['ash', 'bel', 'gm']), 'gm');
	t = addOpponent(t, { id: 'zombies', name: 'Zombie', count: 3 });
	return beginRound(t, { playerHand: 4, gmHand: 4, rng: seededRng(1) });
}

const hand = (t: CardTable, seat: string) => t.zones[seatZone(seat, 'hand')].cards;
/** The card in a hand with this value. */
const card = (t: CardTable, seat: string, value: number) => {
	const found = hand(t, seat).find((c) => t.valueOf[c] === value);
	if (!found) throw new Error(`no ${value} in ${seat}'s hand: ${hand(t, seat).join(',')}`);
	return found;
};
const from = (t: CardTable, seat: string, value: number) => ({
	zone: seatZone(seat, 'hand'),
	card: card(t, seat, value)
});

/** Initiative: Ash 2, Bel 6, the zombies 3. */
function initiative(): CardTable {
	let t = dealt();
	t = ok(playInitiative(t, 'ash', from(t, 'ash', 2), 'ash'));
	t = ok(playInitiative(t, 'bel', from(t, 'bel', 6), 'bel'));
	expect(t.round.step).toBe('initiative');
	t = ok(playInitiative(t, 'zombies', from(t, 'gm', 3), 'gm'));
	return t;
}

describe('initiative', () => {
	it('waits for every adventurer and every group, then starts the count by itself', () => {
		let t = dealt();
		expect(t.round.step).toBe('initiative');
		expect(waitingForInitiative(t).sort()).toEqual(['ash', 'bel', 'zombies']);
		t = initiative();
		expect(t.round.step).toBe('turn');
		expect(t.round.count).toBe(2);
		expect(upAt(t)).toEqual(['ash']);
	});

	it('turns the acting card face up for everyone, and keeps the rest hidden', () => {
		const t = initiative();
		const bel = projectFor(t, 'bel');
		expect(bel.zones[seatZone('ash', 'initiative')].cards).toBeDefined();
		expect(projectFor(t, 'ash').zones[seatZone('bel', 'initiative')].cards).toBeUndefined();
		expect(bel.zones[opponentZone('zombies', 'initiative')].cards).toBeUndefined();
	});

	it('can be changed before the count starts, the old card back in hand', () => {
		let t = dealt();
		const first = card(t, 'ash', 2);
		t = ok(playInitiative(t, 'ash', from(t, 'ash', 2), 'ash'));
		t = ok(playInitiative(t, 'ash', from(t, 'ash', 3), 'ash'));
		expect(hand(t, 'ash')).toContain(first);
		expect(t.zones[seatZone('ash', 'initiative')].cards).toHaveLength(1);
	});

	it('lets the GM start the count without waiting for somebody quiet', () => {
		let t = dealt();
		t = ok(playInitiative(t, 'ash', from(t, 'ash', 2), 'ash'));
		t = ok(startCount(t));
		expect(t.round.count).toBe(2);
		expect(startCount(t)).toEqual({ ok: false, reason: 'wrong-step' });
	});

	it('refuses a card put down as initiative by somebody else', () => {
		const t = dealt();
		expect(playInitiative(t, 'ash', from(t, 'bel', 6), 'bel')).toEqual({
			ok: false,
			reason: 'not-yours'
		});
	});
});

describe('a turn', () => {
	it('lays the card face up with what it was for, and turns the target’s card over', () => {
		let t = initiative();
		const played = card(t, 'ash', 1);
		t = ok(
			playTurn(
				t,
				'ash',
				{ from: from(t, 'ash', 1), action: 'Attack', target: 'zombies:B', mode: 'play' },
				'ash'
			)
		);
		expect(t.zones[seatZone('ash', 'played')].cards).toContain(played);
		expect(t.plays[played]).toMatchObject({
			by: 'ash',
			action: 'Attack',
			kind: 'turn',
			adds: true,
			number: 2
		});
		// Attacking Zombie B turns the zombies' initiative face up.
		expect(t.round.shown).toContain('zombies');
		expect(t.round.step).toBe('minor');
	});

	it('is refused to anybody whose number it is not, and in the wrong step', () => {
		const t = initiative();
		const bel = playTurn(
			t,
			'bel',
			{ from: from(t, 'bel', 5), action: 'Attack', mode: 'play' },
			'bel'
		);
		expect(bel).toEqual({ ok: false, reason: 'not-up' });
		expect(skipTurn(dealt(), 'ash')).toEqual({ ok: false, reason: 'wrong-step' });
	});

	it('skipped, opens no minor actions and moves the count on', () => {
		let t = ok(skipTurn(initiative(), 'ash'));
		expect(t.round.step).toBe('turn');
		expect(t.round.count).toBe(3);
		expect(upAt(t)).toEqual(['zombies']);
		t = ok(skipTurn(t, 'zombies'));
		t = ok(skipTurn(t, 'bel'));
		expect(t.round.step).toBe('over');
	});

	it('readied, goes sideways with its action and is used on another turn', () => {
		let t = initiative();
		const dodge = card(t, 'ash', 4);
		t = ok(playTurn(t, 'ash', { from: from(t, 'ash', 4), action: 'Dodge', mode: 'ready' }, 'ash'));
		expect(t.zones[seatZone('ash', 'facedown')].cards).toEqual([dodge]);
		expect(t.facedown[seatZone('ash', 'facedown')]).toEqual({ position: 'turn', label: 'Dodge' });
		t = ok(useReadied(t, 'ash'));
		// Readied on a turn, it adds the attribute when it turns over (ch.7).
		expect(t.plays[dodge]).toMatchObject({
			by: 'ash',
			action: 'Dodge',
			kind: 'readied',
			adds: true
		});
	});

	it('Guard replaces the initiative and cannot buy a second turn', () => {
		let t = initiative();
		const old = t.zones[seatZone('ash', 'initiative')].cards[0];
		// Guard with a 14: a higher number than anyone's, still to come.
		t = ok(playTurn(t, 'ash', { from: from(t, 'ash', 3), action: 'Guard', mode: 'guard' }, 'ash'));
		expect(t.zones[seatZone('ash', 'initiative')].cards).not.toContain(old);
		expect(t.zones['discard:player'].cards).toContain(old);
		expect(t.round.shown).not.toContain('ash');
		// Through the round: Ash is never up again.
		t = ok(passMinor(t, expectedMinor(t)));
		// Nothing face up, so the count has already moved on.
		for (let guard = 0; guard < 10 && t.round.step !== 'over'; guard++) {
			expect(upAt(t)).not.toContain('ash');
			t = ok(stepOn(t));
		}
		expect(t.round.step).toBe('over');
	});

	it('skips somebody whose hand is empty when their number comes', () => {
		let t = initiative();
		const empty = { ...t.zones[seatZone('ash', 'hand')], cards: [] };
		t = { ...t, zones: { ...t.zones, [empty.id]: empty } };
		t = nextNumber({ ...t, round: { ...t.round, step: 'initiative', count: null, acted: [] } });
		expect(t.round.acted).toContain('ash');
		expect(t.round.count).toBe(3);
	});
});

describe('minor actions', () => {
	function minorOpen() {
		const t = initiative();
		return ok(
			playTurn(t, 'ash', { from: from(t, 'ash', 1), action: 'Attack', mode: 'play' }, 'ash')
		);
	}

	it('ask everyone who did not just act', () => {
		expect(expectedMinor(minorOpen()).sort()).toEqual(['bel', 'zombies']);
	});

	it('stay face down until the last answer, then turn over together', () => {
		let t = minorOpen();
		const belCard = card(t, 'bel', 5);
		t = ok(declareMinor(t, 'bel', from(t, 'bel', 5), 'Roughhouse', 'bel'));
		expect(t.round.step).toBe('minor');
		expect(projectFor(t, 'ash').zones[seatZone('bel', 'minor')].cards).toBeUndefined();
		expect(projectFor(t, 'ash').minorDeclared[seatZone('bel', 'minor')]).toBe('Roughhouse');
		t = ok(passMinor(t, ['zombies']));
		expect(t.round.step).toBe('resolve');
		expect(t.zones[seatZone('bel', 'played')].cards).toEqual([belCard]);
		// "A minor action's total value equals the card's face value."
		expect(t.plays[belCard]).toMatchObject({ action: 'Roughhouse', kind: 'minor', adds: false });
		expect(projectFor(t, 'ash').zones[seatZone('bel', 'played')].cards).toEqual([belCard]);
	});

	it('take a readied minor action sideways, below the initiative, and keep it', () => {
		let t = minorOpen();
		t = ok(readyMinor(t, 'bel', from(t, 'bel', 5), 'Riposte', 'bel'));
		expect(t.facedown[seatZone('bel', 'facedown')]).toEqual({
			position: 'minor',
			label: 'Riposte'
		});
		t = ok(passMinor(t, ['zombies']));
		t = ok(resolveNumber(t));
		// Resolving the number does not touch a readied card.
		expect(t.zones[seatZone('bel', 'facedown')].cards).toHaveLength(1);
		// Readied as a minor, it is face value when it turns over.
		const riposte = t.zones[seatZone('bel', 'facedown')].cards[0];
		t = ok(useReadied(t, 'bel'));
		expect(t.plays[riposte]).toMatchObject({ action: 'Riposte', kind: 'readied', adds: false });
	});

	it('refuse a second answer, and an answer from whoever just acted', () => {
		let t = minorOpen();
		t = ok(passMinor(t, ['bel']));
		expect(passMinor(t, ['bel'])).toEqual({ ok: false, reason: 'already-answered' });
		expect(passMinor(t, ['ash'])).toEqual({ ok: false, reason: 'not-up' });
	});

	it('carry who they are aimed at, and turn the target’s initiative over with them', () => {
		// The second live test: a minor Attack had nowhere to say who it was at.
		let t = minorOpen();
		const belCard = card(t, 'bel', 5);
		t = ok(declareMinor(t, 'bel', from(t, 'bel', 5), 'Attack', 'bel', 'zombies:A'));
		expect(t.minorTargets[seatZone('bel', 'minor')]).toBe('zombies:A');
		expect(t.round.shown).not.toContain('zombies');
		t = ok(passMinor(t, ['zombies']));
		expect(t.plays[belCard]).toMatchObject({
			action: 'Attack',
			target: 'zombies:A',
			kind: 'minor'
		});
		expect(t.round.shown).toContain('zombies');
		expect(t.minorTargets).toEqual({});
	});

	it('turn over at once on the GM’s say-so for somebody quiet', () => {
		let t = minorOpen();
		t = ok(declareMinor(t, 'bel', from(t, 'bel', 5), 'Aid Another', 'bel'));
		t = ok(stepOn(t));
		expect(t.round.step).toBe('resolve');
		expect(t.zones[seatZone('bel', 'played')].cards).toHaveLength(1);
	});
});

describe('resolving a number', () => {
	it('sends every played card to its own discard and moves the count on', () => {
		let t = initiative();
		t = ok(playTurn(t, 'ash', { from: from(t, 'ash', 1), action: 'Attack', mode: 'play' }, 'ash'));
		t = ok(declareMinor(t, 'zombies', from(t, 'gm', 1), 'Attack', 'gm'));
		t = ok(passMinor(t, ['bel']));
		t = ok(resolveNumber(t));
		expect(t.zones[seatZone('ash', 'played')].cards).toEqual([]);
		expect(t.zones[opponentZone('zombies', 'played')].cards).toEqual([]);
		for (const c of t.zones['discard:gm'].cards) expect(t.deckOf[c]).toBe('gm');
		for (const c of t.zones['discard:player'].cards) expect(t.deckOf[c]).toBe('player');
		expect(t.plays).toEqual({});
		expect(t.round.count).toBe(3);
		expect(upAt(t)).toEqual(['zombies']);
	});
});

describe('the Fool, out of turn', () => {
	it('is played on somebody else’s turn without costing its holder their own', () => {
		let t = initiative();
		t = ok(playOutOfTurn(t, 'bel', { from: from(t, 'bel', 7), action: 'Fool: Attack' }, 'bel'));
		expect(t.round.acted).not.toContain('bel');
		expect(t.round.step).toBe('turn');
		const played = t.zones[seatZone('bel', 'played')].cards[0];
		// The Fool's extra turn is a turn: it adds the attribute.
		expect(t.plays[played]).toMatchObject({
			kind: 'out-of-turn',
			action: 'Fool: Attack',
			adds: true
		});
	});
});

describe('taking it back', () => {
	it('returns your turn’s cards before anyone has answered, and not after', () => {
		let t = initiative();
		const attack = card(t, 'ash', 1);
		t = ok(playTurn(t, 'ash', { from: from(t, 'ash', 1), action: 'Attack', mode: 'play' }, 'ash'));
		const back = ok(takeBack(t, 'ash'));
		expect(hand(back, 'ash')).toContain(attack);
		expect(back.round.step).toBe('turn');
		expect(upAt(back)).toEqual(['ash']);

		t = ok(passMinor(t, ['bel']));
		expect(takeBack(t, 'ash')).toEqual({ ok: false, reason: 'nothing-to-take-back' });
	});
});

describe('the end of the round', () => {
	it('clears the steps, the shown cards and the labels, and waits for the deal', () => {
		let t = initiative();
		for (let guard = 0; guard < 12 && t.round.step !== 'over'; guard++) t = ok(stepOn(t));
		expect(t.round.step).toBe('over');
		t = endRound(t, seededRng(2));
		expect(t.round).toMatchObject({ step: 'deal', shown: [], acted: [], count: null });
		expect(t.plays).toEqual({});
	});
});

describe('a table saved mid-round before v15', () => {
	it('opens on the turn of whoever holds the count, with those below it acted', () => {
		const t = initiative();
		const old = {
			...t,
			schemaVersion: 14,
			guided: true,
			round: {
				number: 1,
				count: 3,
				minorActions: false,
				foolDrawn: false,
				interrupt: null,
				extraTurn: null,
				settled: null
			}
		} as unknown as CardTable;
		const migrated = migrateTable(old);
		expect(migrated.round).toMatchObject({ step: 'turn', count: 3, acted: ['ash'] });
		expect(migrated.round.shown.sort()).toEqual(['ash', 'zombies']);
		expect(upAt(migrated)).toEqual(['zombies']);
		expect('guided' in migrated).toBe(false);
	});

	it('opens a dealt round with no count on initiative, and gives every seat a minor slot', () => {
		const t = dealt();
		const zones = Object.fromEntries(
			Object.entries(t.zones).filter(([id]) => !id.endsWith(':minor'))
		);
		const old = {
			...t,
			zones,
			schemaVersion: 14,
			round: { number: 1, count: null, foolDrawn: false }
		} as unknown as CardTable;
		const migrated = migrateTable(old);
		expect(migrated.round.step).toBe('initiative');
		expect(migrated.zones[seatZone('ash', 'minor')]).toBeDefined();
		expect(migrated.zones[opponentZone('zombies', 'minor')]).toBeDefined();
	});
});

describe('a table saved before v17', () => {
	it('keeps its plays, with neither "+ attribute" nor "face value"', () => {
		let t = initiative();
		t = ok(playTurn(t, 'ash', { from: from(t, 'ash', 1), action: 'Attack', mode: 'play' }, 'ash'));
		const played = t.zones[seatZone('ash', 'played')].cards[0];
		const { adds: _adds, ...old } = t.plays[played];
		const v16 = { ...t, schemaVersion: 16, plays: { [played]: old } } as CardTable;
		const migrated = migrateTable(v16);
		expect(migrated.schemaVersion).toBe(TABLE_SCHEMA_VERSION);
		expect(migrated.plays[played]).toEqual(old);
		expect(migrated.plays[played]).not.toHaveProperty('adds');
	});
});

describe('minor actions, from Card Table Test 3', () => {
	/** Ash has played on 2; Bel (6) and the zombies (3) are asked for minor actions. */
	function minorOpen() {
		const t = initiative();
		return ok(
			playTurn(t, 'ash', { from: from(t, 'ash', 1), action: 'Attack', mode: 'play' }, 'ash')
		);
	}
	const initOf = (t: CardTable, slot: string) => t.zones[slot].cards[0];

	it('Guard as a minor swaps the initiative when the minors turn over', () => {
		let t = minorOpen();
		const old = initOf(t, seatZone('bel', 'initiative'));
		const eight = card(t, 'bel', 8);
		t = ok(declareMinor(t, 'bel', from(t, 'bel', 8), 'Guard', 'bel', undefined, true));
		// Face down until everyone has answered, like any minor action.
		expect(initOf(t, seatZone('bel', 'initiative'))).toBe(old);
		t = ok(passMinor(t, ['zombies']));
		expect(initOf(t, seatZone('bel', 'initiative'))).toBe(eight);
		expect(t.zones['discard:player'].cards).toContain(old);
		expect(t.round.shown).toContain('bel');
		expect(t.minorGuards).toEqual([]);
		// Above the count, so Bel still has a turn to come: on 8 now, not 6.
		expect(t.round.acted).not.toContain('bel');
		t = ok(resolveNumber(t));
		expect(upAt(t)).toEqual(['zombies']);
		t = ok(skipTurn(t, 'zombies'));
		expect(t.round.count).toBe(8);
		expect(upAt(t)).toEqual(['bel']);
	});

	it('loses the turn when the new initiative has already gone (Chris, 26 November)', () => {
		// Card Table Test 3: the Devil Guarded with a 1 as a minor, and its turn
		// still came up on its old 14. If you move to an initiative that has
		// already gone, you lose your turn.
		let t = minorOpen();
		const one = card(t, 'gm', 1);
		t = ok(declareMinor(t, 'zombies', from(t, 'gm', 1), 'Guard', 'gm', undefined, true));
		t = ok(passMinor(t, ['bel']));
		expect(initOf(t, opponentZone('zombies', 'initiative'))).toBe(one);
		expect(t.round.acted).toContain('zombies');
		t = ok(resolveNumber(t));
		// The count doesn't step back to 1, and the zombies' 3 is gone: Bel next.
		expect(t.round.count).toBe(6);
		expect(upAt(t)).toEqual(['bel']);
	});

	it('loses the turn on the number being counted too', () => {
		let t = minorOpen();
		t = ok(declareMinor(t, 'zombies', from(t, 'gm', 2), 'Guard', 'gm', undefined, true));
		t = ok(passMinor(t, ['bel']));
		expect(t.round.acted).toContain('zombies');
	});

	it('a Guard label without the flag is only a label', () => {
		let t = minorOpen();
		const old = initOf(t, seatZone('bel', 'initiative'));
		t = ok(declareMinor(t, 'bel', from(t, 'bel', 8), 'Guard', 'bel'));
		t = ok(passMinor(t, ['zombies']));
		expect(initOf(t, seatZone('bel', 'initiative'))).toBe(old);
	});

	it('can be taken back until the minors turn over, and answered again', () => {
		let t = minorOpen();
		const five = card(t, 'bel', 5);
		t = ok(declareMinor(t, 'bel', from(t, 'bel', 5), 'Attack', 'bel', 'zombies:A', true));
		t = ok(takeBack(t, 'bel'));
		expect(hand(t, 'bel')).toContain(five);
		expect(t.round.answered).not.toContain('bel');
		expect(t.minorDeclared).toEqual({});
		expect(t.minorTargets).toEqual({});
		expect(t.minorGuards).toEqual([]);
		expect(t.round.step).toBe('minor');
		// Answered again, the minors turn over as usual.
		t = ok(passMinor(t, ['bel', 'zombies']));
		expect(t.round.step).toBe('resolve');
	});

	it('takes back a minor readied at this number, and not one readied before', () => {
		let t = minorOpen();
		const seven = card(t, 'bel', 7);
		t = ok(readyMinor(t, 'bel', from(t, 'bel', 7), 'Riposte', 'bel'));
		t = ok(takeBack(t, 'bel'));
		expect(hand(t, 'bel')).toContain(seven);
		expect(t.zones[seatZone('bel', 'facedown')].cards).toEqual([]);
		expect(t.facedown[seatZone('bel', 'facedown')]).toBeUndefined();
		expect(t.round.answered).not.toContain('bel');

		t = ok(readyMinor(t, 'bel', from(t, 'bel', 7), 'Riposte', 'bel'));
		t = ok(passMinor(t, ['zombies']));
		// Turned over: it is a readied card now, kept, not this number's to take back.
		expect(t.round.readiedNow).toEqual([]);
		expect(t.zones[seatZone('bel', 'facedown')].cards).toEqual([seven]);
	});

	it('leaves the acting player’s own take-back as it was', () => {
		let t = minorOpen();
		t = ok(takeBack(t, 'ash'));
		expect(t.round.step).toBe('turn');
		expect(upAt(t)).toEqual(['ash']);
	});

	it('does not ask a holder whose only card is the Fool, which needs a partner', () => {
		let t = minorOpen();
		const lone = { ...t.zones[seatZone('bel', 'hand')], cards: ['fool'] };
		t = { ...t, zones: { ...t.zones, [lone.id]: lone } };
		expect(expectedMinor(t)).toEqual(['zombies']);
	});

	it('moves the count past a holder with only the Fool, as past an empty hand', () => {
		let t = initiative();
		const lone = { ...t.zones[seatZone('ash', 'hand')], cards: ['fool'] };
		t = { ...t, zones: { ...t.zones, [lone.id]: lone } };
		t = nextNumber({ ...t, round: { ...t.round, step: 'initiative', count: null, acted: [] } });
		expect(t.round.acted).toContain('ash');
		expect(t.round.count).toBe(3);
	});
});

describe('a table saved before v18', () => {
	it('has no minor Guards and nobody readied at this number', () => {
		const t = initiative();
		const { minorGuards: _g, ...rest } = t;
		const { readiedNow: _r, ...round } = t.round;
		const migrated = migrateTable({ ...rest, round, schemaVersion: 17 } as unknown as CardTable);
		expect(migrated.minorGuards).toEqual([]);
		expect(migrated.round.readiedNow).toEqual([]);
		expect(migrated.round.step).toBe(t.round.step);
	});
});

describe('discarding a card for a miscellaneous action (phase 33)', () => {
	it('puts it face up on its own discard, and costs nobody a turn', () => {
		let t = initiative();
		const five = card(t, 'bel', 5);
		const before = t.round;
		t = ok(discardFor(t, 'bel', from(t, 'bel', 5), 'bel'));
		expect(t.zones['discard:player'].cards[0]).toBe(five);
		expect(hand(t, 'bel')).not.toContain(five);
		expect(t.round).toEqual(before);
	});

	it('lets the GM discard for a group, from the GM’s hand, to the GM discard', () => {
		let t = initiative();
		const four = card(t, 'gm', 4);
		t = ok(discardFor(t, 'zombies', from(t, 'gm', 4), 'gm'));
		expect(t.zones['discard:gm'].cards[0]).toBe(four);
	});

	it('takes only from the holder’s own hand, and only mid-round', () => {
		const t = initiative();
		expect(discardFor(t, 'bel', from(t, 'ash', 1), 'bel')).toEqual({
			ok: false,
			reason: 'not-yours'
		});
		expect(discardFor(t, 'bel', from(t, 'bel', 5), 'ash')).toEqual({
			ok: false,
			reason: 'not-your-hand'
		});
		const d = dealt();
		expect(discardFor(d, 'bel', from(d, 'bel', 5), 'bel')).toEqual({
			ok: false,
			reason: 'wrong-step'
		});
	});
});
