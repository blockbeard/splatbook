import { describe, expect, it } from 'vitest';
import { createTable, migrateTable, setGmSeat, type CardTable, type DeckDefinition } from './table';
import { beginRound, endRound } from './round';
import { setMode } from './mode';
import { moveCard } from './moves';
import { counselFor, giveCard, liveCounsel } from './counsel';
import { hiddenFrom, projectFor } from './projection';
import { seededRng } from './shuffle';
import { seatZone } from './zones';

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

/** Eldritch, Tatyana and Bonnie in a Challenge, hands dealt in pack order. */
function fight(): CardTable {
	const t = setMode(setGmSeat(createTable(deck, ['eld', 'tat', 'bon', 'gm']), 'gm'), 'challenge');
	return beginRound(t, { playerHand: 4, gmHand: 2, rng: seededRng(3) });
}
const hand = (t: CardTable, seat: string) => t.zones[seatZone(seat, 'hand')].cards;
const recover = { action: 'Recover', interrupt: false };

function given() {
	const t = fight();
	const card = hand(t, 'eld')[0];
	const out = giveCard(t, 'eld', 'tat', { zone: seatZone('eld', 'hand'), card }, recover);
	if (!out.ok) throw new Error(out.reason);
	return { t: out.table, card };
}

describe('handing a card over (Counsel)', () => {
	it('moves the card from one hand to the other, with the advice', () => {
		const { t, card } = given();
		expect(hand(t, 'eld')).not.toContain(card);
		expect(hand(t, 'tat')[0]).toBe(card);
		expect(t.counsel[card]).toEqual({
			from: 'eld',
			to: 'tat',
			action: 'Recover',
			interrupt: false
		});
	});

	it('tells only the receiver which card carries the advice', () => {
		const { t, card } = given();
		expect(counselFor(t, 'tat')).toEqual({ [card]: t.counsel[card] });
		for (const viewer of ['eld', 'bon', 'gm', undefined]) {
			expect(counselFor(t, viewer)).toEqual({});
			const serialised = JSON.stringify(projectFor(t, viewer));
			for (const hidden of hiddenFrom(t, viewer)) {
				expect(new RegExp(`"${hidden}"`).test(serialised)).toBe(false);
			}
		}
	});

	it('spends the advice once the card leaves the receiver’s hand', () => {
		const { t, card } = given();
		const played = moveCard(
			t,
			{ zone: seatZone('tat', 'hand'), card },
			seatZone('tat', 'played'),
			'tat'
		);
		if (!played.ok) throw new Error(played.reason);
		expect(liveCounsel(played.table)).toEqual({});
		expect(counselFor(played.table, 'tat')).toEqual({});
	});

	it('is cleared at the end of the round, with the hands', () => {
		const { t } = given();
		expect(endRound(t, seededRng(1)).counsel).toEqual({});
	});

	it('refuses what makes no sense, and nothing else', () => {
		const t = fight();
		const from = { zone: seatZone('eld', 'hand') };
		expect(giveCard(t, 'eld', 'eld', from, recover)).toEqual({
			ok: false,
			reason: 'not-to-yourself'
		});
		expect(giveCard(t, 'eld', 'gm', from, recover)).toEqual({ ok: false, reason: 'not-to-the-gm' });
		expect(giveCard(t, 'eld', 'tat', { zone: seatZone('bon', 'hand') }, recover)).toEqual({
			ok: false,
			reason: 'not-yours'
		});
		expect(giveCard(setMode(t, 'decks'), 'eld', 'tat', from, recover)).toEqual({
			ok: false,
			reason: 'wrong-mode'
		});
	});
});

describe('a table saved before v19', () => {
	it('has handed nothing over', () => {
		const { counsel: _c, ...old } = fight();
		const migrated = migrateTable({ ...old, schemaVersion: 18 } as unknown as CardTable);
		expect(migrated.counsel).toEqual({});
	});
});
