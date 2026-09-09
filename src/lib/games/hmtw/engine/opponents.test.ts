import { describe, expect, it } from 'vitest';
import {
	TABLE_SCHEMA_VERSION,
	addOpponent,
	createTable,
	migrateTable,
	removeOpponent,
	setGmSeat,
	splitOpponent,
	updateOpponent,
	type CardTable,
	type DeckDefinition
} from './table';
import { moveCard } from './moves';
import { opponentZone } from './zones';

const deck: DeckDefinition = {
	minors: [
		{ id: 'm1', value: 1 },
		{ id: 'm2', value: 2 },
		{ id: 'm3', value: 3 }
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
const table = (): CardTable => createTable(deck, ['s1']);

describe('opponents', () => {
	it('starts empty — a table is not a fight', () => {
		expect(table().opponents).toEqual([]);
	});

	it('adds an enemy with its zones, and no hand', () => {
		const t = addOpponent(table(), { id: 'imps', name: 'Imps', count: 12 });
		expect(t.opponents).toEqual([{ id: 'imps', name: 'Imps', count: 12 }]);
		expect(t.zones[opponentZone('imps', 'initiative')]).toBeDefined();
		expect(t.zones[opponentZone('imps', 'played')]).toBeDefined();
		expect(t.zones[opponentZone('imps', 'facedown')]).toBeDefined();
		// Ch7: the GM draws one hand of majors for everything they control.
		expect(t.zones['opponent:imps:hand']).toBeUndefined();
	});

	it('defaults a lone enemy to a count of one', () => {
		const t = addOpponent(table(), { id: 'ogre', name: 'Ogre' });
		expect(t.opponents[0].count).toBe(1);
	});

	it('can be added mid-fight, because reinforcements arrive', () => {
		let t = addOpponent(table(), { id: 'imps', name: 'Imps', count: 3 });
		const dealt = moveCard(t, { zone: 'deck:gm' }, opponentZone('imps', 'initiative'));
		expect(dealt.ok).toBe(true);
		if (!dealt.ok) return;
		t = addOpponent(dealt.table, { id: 'ogre', name: 'Ogre' });
		expect(t.opponents.map((o) => o.id)).toEqual(['imps', 'ogre']);
		// The fight in progress is undisturbed.
		expect(t.zones[opponentZone('imps', 'initiative')].cards).toHaveLength(1);
	});

	it('ignores a duplicate id rather than clobbering a fight in progress', () => {
		const t = addOpponent(table(), { id: 'imps', name: 'Imps', count: 3 });
		expect(addOpponent(t, { id: 'imps', name: 'Something else', count: 9 })).toBe(t);
	});

	it('removes an enemy and its zones, leaving the rest of the fight alone', () => {
		let t = addOpponent(table(), { id: 'imps', name: 'Imps', count: 3 });
		t = addOpponent(t, { id: 'ogre', name: 'Ogre' });
		t = removeOpponent(t, 'imps');
		expect(t.opponents.map((o) => o.id)).toEqual(['ogre']);
		expect(t.zones[opponentZone('imps', 'played')]).toBeUndefined();
		expect(t.zones[opponentZone('ogre', 'played')]).toBeDefined();
		expect(t.zones['deck:gm']).toBeDefined();
	});

	it('renames and re-counts', () => {
		let t = addOpponent(table(), { id: 'imps', name: 'Imps', count: 12 });
		t = updateOpponent(t, 'imps', { count: 7 });
		expect(t.opponents[0]).toEqual({ id: 'imps', name: 'Imps', count: 7 });
		t = updateOpponent(t, 'imps', { name: 'Surviving imps' });
		expect(t.opponents[0].name).toBe('Surviving imps');
	});
});

describe('splitting a group', () => {
	it('peels some off into a new entry with its own slots', () => {
		let t = addOpponent(table(), { id: 'unwolves', name: 'Unwolves', count: 5 });
		t = splitOpponent(t, 'unwolves', { id: 'unwolves-b', count: 2 });
		expect(t.opponents).toEqual([
			{ id: 'unwolves', name: 'Unwolves', count: 3 },
			{ id: 'unwolves-b', name: 'Unwolves', count: 2 }
		]);
		expect(t.zones[opponentZone('unwolves-b', 'initiative')].cards).toEqual([]);
	});

	it('leaves the original’s cards where they were', () => {
		let t = addOpponent(table(), { id: 'unwolves', name: 'Unwolves', count: 5 });
		const played = moveCard(t, { zone: 'deck:gm' }, opponentZone('unwolves', 'played'));
		if (!played.ok) return;
		t = splitOpponent(played.table, 'unwolves', { id: 'unwolves-b', count: 2 });
		expect(t.zones[opponentZone('unwolves', 'played')].cards).toHaveLength(1);
		expect(t.zones[opponentZone('unwolves-b', 'played')].cards).toEqual([]);
	});

	it('takes a new name when given one', () => {
		let t = addOpponent(table(), { id: 'unwolves', name: 'Unwolves', count: 5 });
		t = splitOpponent(t, 'unwolves', { id: 'flankers', name: 'Flanking unwolves', count: 2 });
		expect(t.opponents[1].name).toBe('Flanking unwolves');
	});

	it('does nothing when there is no such state to represent', () => {
		const t = addOpponent(table(), { id: 'ogre', name: 'Ogre', count: 1 });
		// A group of one cannot be split, and you cannot take more than there are.
		expect(splitOpponent(t, 'ogre', { id: 'ogre-b', count: 1 })).toBe(t);
		expect(splitOpponent(t, 'ogre', { id: 'ogre-b', count: 0 })).toBe(t);
		expect(splitOpponent(t, 'nobody', { id: 'x', count: 1 })).toBe(t);
	});
});

describe('the GM seat', () => {
	it('is a pointer, so opponent zones survive it changing hands', () => {
		let t = addOpponent(setGmSeat(table(), 's1'), { id: 'imps', name: 'Imps' });
		const zonesBefore = t.zones[opponentZone('imps', 'initiative')];
		// The seat is vacated and claimed by someone else — the rule that stops a
		// lost cookie locking out a table whose joins the GM approves.
		t = setGmSeat(t, null);
		t = setGmSeat(t, 's2');
		expect(t.gmSeat).toBe('s2');
		expect(t.zones[opponentZone('imps', 'initiative')]).toBe(zonesBefore);
	});

	it('hides an opponent’s initiative from the players but not the GM', () => {
		const t = addOpponent(table(), { id: 'imps', name: 'Imps' });
		expect(t.zones[opponentZone('imps', 'initiative')].visibility).toBe('gm');
		// What it plays face up is everyone's business.
		expect(t.zones[opponentZone('imps', 'played')].visibility).toBe('public');
	});

	it('refuses a named card out of an opponent’s facedown slot, same as a hand', () => {
		let t = addOpponent(table(), { id: 'imps', name: 'Imps' });
		const hidden = moveCard(t, { zone: 'deck:gm' }, opponentZone('imps', 'facedown'));
		if (!hidden.ok) return;
		t = hidden.table;
		expect(
			moveCard(t, { zone: opponentZone('imps', 'facedown'), card: hidden.card }, 'discard:gm')
		).toEqual({ ok: false, reason: 'card-named-in-private-zone' });
	});
});

describe('migrateTable v1 → v2', () => {
	it('gives a table that predates opponents an empty roster and no GM', () => {
		// A real v1 blob: seats and zones, nothing else.
		const v1 = {
			schemaVersion: 1,
			seats: ['s1', 's2'],
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

		const migrated = migrateTable(v1);
		expect(migrated.schemaVersion).toBe(TABLE_SCHEMA_VERSION);
		expect(migrated.opponents).toEqual([]);
		expect(migrated.gmSeat).toBeNull();
		// The cards a table was mid-round on are untouched.
		expect(migrated.seats).toEqual(['s1', 's2']);
		expect(migrated.zones['deck:player'].cards).toEqual(['m1']);
	});

	it('leaves a v2 table’s own roster alone', () => {
		const t = addOpponent(setGmSeat(table(), 's1'), { id: 'imps', name: 'Imps', count: 4 });
		const migrated = migrateTable(t);
		expect(migrated.opponents).toEqual([{ id: 'imps', name: 'Imps', count: 4 }]);
		expect(migrated.gmSeat).toBe('s1');
	});
});
