/**
 * The round in steps (phase 32): whole rounds, played the way the first live
 * test's table should have played them.
 */

import { describe, expect, it } from 'vitest';
import { addOpponent, createTable, migrateTable, setGmSeat, type CardTable } from './table';
import type { DeckDefinition } from './table';
import { beginRound, endRound } from './round';
import { seededRng } from './shuffle';
import { opponentZone, seatZone } from './zones';
import { projectFor } from './projection';
import {
	declareMinor,
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
		expect(t.plays[played]).toMatchObject({ by: 'ash', action: 'Attack', kind: 'turn', number: 2 });
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
		expect(t.plays[dodge]).toMatchObject({ by: 'ash', action: 'Dodge', kind: 'readied' });
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
		expect(t.plays[belCard]).toMatchObject({ action: 'Roughhouse', kind: 'minor' });
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
	});

	it('refuse a second answer, and an answer from whoever just acted', () => {
		let t = minorOpen();
		t = ok(passMinor(t, ['bel']));
		expect(passMinor(t, ['bel'])).toEqual({ ok: false, reason: 'already-answered' });
		expect(passMinor(t, ['ash'])).toEqual({ ok: false, reason: 'not-up' });
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
		expect(t.plays[played]).toMatchObject({ kind: 'out-of-turn', action: 'Fool: Attack' });
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
