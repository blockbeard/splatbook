import { describe, expect, it } from 'vitest';
import {
	TABLE_SCHEMA_VERSION,
	addOpponent,
	createTable,
	migrateTable,
	removeOpponent,
	setGmSeat,
	upCount,
	updateOpponent,
	type CardTable,
	type DeckDefinition
} from './table';
import { moveCard } from './moves';
import { opponentZone } from './zones';
import { MAX_CREATURES, letterFor, letterIndex } from './creatures';
import { placeInScene, setSceneZones } from './scene';

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
		expect(t.opponents).toHaveLength(1);
		expect(upCount(t.opponents[0])).toBe(12);
		expect(t.zones[opponentZone('imps', 'initiative')]).toBeDefined();
		expect(t.zones[opponentZone('imps', 'played')]).toBeDefined();
		expect(t.zones[opponentZone('imps', 'facedown')]).toBeDefined();
		// Ch7: the GM draws one hand of majors for everything they control.
		expect(t.zones['opponent:imps:hand']).toBeUndefined();
	});

	it('defaults a lone enemy to one creature', () => {
		const t = addOpponent(table(), { id: 'ogre', name: 'Ogre' });
		expect(upCount(t.opponents[0])).toBe(1);
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

	it('renames, and ignores a blank name', () => {
		let t = addOpponent(table(), { id: 'imps', name: 'Imps', count: 12 });
		t = updateOpponent(t, 'imps', { name: 'Surviving imps' });
		expect(t.opponents[0].name).toBe('Surviving imps');
		expect(updateOpponent(t, 'imps', { name: '   ' })).toBe(t);
	});
});

describe('creatures', () => {
	it('letters a group from A, each with the HD the GM gave', () => {
		const t = addOpponent(table(), {
			id: 'zombies',
			name: 'Zombie',
			count: 3,
			health: 1,
			defense: 0
		});
		const [group] = t.opponents;
		expect(group.creatures.map((c) => c.letter)).toEqual(['A', 'B', 'C']);
		expect(group.creatures[0].pools).toEqual([
			{ health: 1, healthMax: 1, defense: 0, defenseMax: 0 }
		]);
		expect(group.creatures.every((c) => !c.down)).toBe(true);
	});

	it('tracks no HD when none is given', () => {
		const t = addOpponent(table(), { id: 'imps', name: 'Imps', count: 2 });
		expect(t.opponents[0].creatures[0].pools).toEqual([]);
	});

	it('runs A–Z, then AA–ZZ, and stops at fifty-two', () => {
		expect(letterFor(0)).toBe('A');
		expect(letterFor(25)).toBe('Z');
		expect(letterFor(26)).toBe('AA');
		expect(letterFor(51)).toBe('ZZ');
		expect(letterIndex('ZZ')).toBe(51);
		expect(letterIndex('AB')).toBe(-1);
		const t = addOpponent(table(), { id: 'rats', name: 'Rat', count: 999 });
		expect(t.opponents[0].creatures).toHaveLength(MAX_CREATURES);
	});

	it('gives every creature an id no seat or other group can share', () => {
		let t = addOpponent(table(), { id: 'zombies', name: 'Zombie', count: 2 });
		t = addOpponent(t, { id: 'skeletons', name: 'Skeleton', count: 2 });
		const ids = t.opponents.flatMap((o) => o.creatures.map((c) => c.id));
		expect(new Set(ids).size).toBe(4);
		expect(ids).not.toContain('s1');
	});

	it('takes its creatures out of the scene when the group goes', () => {
		let t = addOpponent(table(), { id: 'zombies', name: 'Zombie', count: 2 });
		t = setSceneZones(t, [{ id: 'arena', name: 'Arena' }]);
		const [a] = t.opponents[0].creatures;
		t = placeInScene(t, a.id, 'arena');
		expect(t.scene.at[a.id]).toBe('arena');
		t = removeOpponent(t, 'zombies');
		expect(a.id in t.scene.at).toBe(false);
	});
});

describe('migrating to v11', () => {
	it('turns a stored count into lettered creatures with no HD', () => {
		const v10 = {
			...table(),
			schemaVersion: 10,
			opponents: [{ id: 'imps', name: 'Imps', count: 6 }]
		};
		const t = migrateTable(v10 as never);
		expect(t.schemaVersion).toBe(TABLE_SCHEMA_VERSION);
		expect(t.opponents[0]).toMatchObject({ id: 'imps', name: 'Imps', family: 'imps' });
		expect(t.opponents[0].creatures.map((c) => c.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
		expect(t.opponents[0].creatures[0].pools).toEqual([]);
		expect('count' in t.opponents[0]).toBe(false);
	});

	it('caps a group the old command allowed to be 999', () => {
		const v10 = {
			...table(),
			schemaVersion: 10,
			opponents: [{ id: 'rats', name: 'Rats', count: 999 }]
		};
		expect(migrateTable(v10 as never).opponents[0].creatures).toHaveLength(MAX_CREATURES);
	});

	it('leaves a current group as it is', () => {
		const t = addOpponent(table(), {
			id: 'zombies',
			name: 'Zombie',
			count: 2,
			health: 1,
			defense: 0
		});
		expect(migrateTable(t).opponents).toEqual(t.opponents);
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
		expect(migrated.opponents).toEqual(t.opponents);
		expect(migrated.gmSeat).toBe('s1');
	});
});
