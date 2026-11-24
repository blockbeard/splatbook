import { describe, expect, it } from 'vitest';
import {
	MAX_SCENE_ZONES,
	clearScene,
	forgetPlacements,
	placeInScene,
	setScenePicture,
	setSceneZones
} from './scene';
import {
	TABLE_SCHEMA_VERSION,
	createTable,
	migrateTable,
	removeSeat,
	setGmSeat,
	type CardTable,
	type DeckDefinition
} from './table';

const deck: DeckDefinition = {
	minors: [{ id: 'm1', value: 1 }],
	majors: [
		{ id: 'fool', value: 0 },
		{ id: 'j1', value: 1 }
	],
	decks: [
		{ id: 'player', arcana: 'minor', includesMajors: ['fool'] },
		{ id: 'gm', arcana: 'major', excludesMajors: ['fool'] }
	]
};

/** Session 11's room: the Arena and the King's Pillar, with Chris in the GM seat. */
const arena = (): CardTable =>
	setSceneZones(setGmSeat(createTable(deck, ['gm', 'regan', 'tatyana']), 'gm'), [
		{ id: 'arena', name: 'Arena' },
		{ id: 'pillar', name: "King's Pillar" }
	]);

describe('the scene', () => {
	it('starts empty — a table is not a room', () => {
		expect(createTable(deck).scene).toEqual({ zones: [], at: {}, picture: null });
	});

	it('takes the zones the GM names, trimmed, in order', () => {
		const t = setSceneZones(createTable(deck), [
			{ id: 'a', name: '  Door ' },
			{ id: 'b', name: 'Nave' },
			{ id: 'c', name: '   ' },
			{ id: 'a', name: 'A second Door' }
		]);
		expect(t.scene.zones).toEqual([
			{ id: 'a', name: 'Door' },
			{ id: 'b', name: 'Nave' }
		]);
	});

	it('stops at a sane number of zones', () => {
		const many = Array.from({ length: MAX_SCENE_ZONES + 5 }, (_, i) => ({
			id: `z${i}`,
			name: `Zone ${i}`
		}));
		expect(setSceneZones(createTable(deck), many).scene.zones).toHaveLength(MAX_SCENE_ZONES);
	});

	it('places an adventurer, and moves them, and takes them out', () => {
		let t = placeInScene(arena(), 'tatyana', 'pillar');
		expect(t.scene.at.tatyana).toBe('pillar');
		t = placeInScene(t, 'tatyana', 'arena');
		expect(t.scene.at.tatyana).toBe('arena');
		t = placeInScene(t, 'tatyana', null);
		expect(t.scene.at.tatyana).toBeNull();
	});

	it('refuses only what has no meaning', () => {
		const t = arena();
		// Nobody by that name is at the table.
		expect(placeInScene(t, 'stranger', 'arena')).toBe(t);
		// There is no such zone.
		expect(placeInScene(t, 'regan', 'balcony')).toBe(t);
		// The GM is not standing in the room.
		expect(placeInScene(t, 'gm', 'arena')).toBe(t);
	});

	it('keeps everybody where they were when a zone is renamed', () => {
		let t = placeInScene(arena(), 'regan', 'arena');
		t = setSceneZones(t, [
			{ id: 'arena', name: 'The Arena floor' },
			{ id: 'pillar', name: "King's Pillar" }
		]);
		expect(t.scene.at.regan).toBe('arena');
		expect(t.scene.zones[0].name).toBe('The Arena floor');
	});

	it('leaves whoever stood in a removed zone unplaced, not guessed elsewhere', () => {
		let t = placeInScene(arena(), 'regan', 'arena');
		t = placeInScene(t, 'tatyana', 'pillar');
		t = setSceneZones(t, [{ id: 'pillar', name: "King's Pillar" }]);
		expect(t.scene.at.regan).toBeNull();
		expect(t.scene.at.tatyana).toBe('pillar');
	});

	it('forgets where somebody stood when their seat goes', () => {
		let t = placeInScene(arena(), 'regan', 'arena');
		t = removeSeat(t, 'regan');
		expect('regan' in t.scene.at).toBe(false);
		expect(forgetPlacements(t, ['nobody'])).toBe(t);
	});

	it('clears to a new scene', () => {
		const t = clearScene(placeInScene(arena(), 'regan', 'arena'));
		expect(t.scene).toEqual({ zones: [], at: {}, picture: null });
	});
});

describe('migrating to v10', () => {
	it('gives a v9 table an empty scene and keeps everything else', () => {
		// A v9 blob, as stored: everything a table had before scenes existed.
		const v9 = { ...createTable(deck, ['s1']), schemaVersion: 9 } as Partial<CardTable>;
		delete v9.scene;
		const migrated = migrateTable(v9 as CardTable);
		expect(migrated.schemaVersion).toBe(TABLE_SCHEMA_VERSION);
		expect(migrated.scene).toEqual({ zones: [], at: {}, picture: null });
		expect(migrated.seats).toEqual(['s1']);
	});

	it('unplaces anybody a stored scene puts in a zone it no longer has', () => {
		const stored = {
			...arena(),
			scene: {
				zones: [{ id: 'arena', name: 'Arena' }],
				at: { regan: 'arena', tatyana: 'gone' },
				picture: null
			}
		};
		expect(migrateTable(stored).scene.at).toEqual({ regan: 'arena', tatyana: null });
	});
});

describe('the scene picture', () => {
	it('is put up, replaced and taken down by reference only', () => {
		const id = '6f1c1b0e-0000-4000-8000-000000000001';
		let t = setScenePicture(arena(), { id, mime: 'image/webp' });
		expect(t.scene.picture).toEqual({ id, mime: 'image/webp' });
		t = setScenePicture(t, null);
		expect(t.scene.picture).toBeNull();
	});

	it('goes with a new scene, and survives renaming the zones', () => {
		const pic = { id: '6f1c1b0e-0000-4000-8000-000000000002', mime: 'image/png' as const };
		let t = setScenePicture(arena(), pic);
		t = setSceneZones(t, [{ id: 'arena', name: 'The Arena floor' }]);
		expect(t.scene.picture).toEqual(pic);
		expect(clearScene(t).scene.picture).toBeNull();
	});

	it('migrates a v11 scene to no picture, and drops one it cannot read', () => {
		const v11 = { ...arena(), schemaVersion: 11, scene: { zones: [], at: {} } };
		expect(migrateTable(v11 as never).scene.picture).toBeNull();
		const odd = {
			...arena(),
			scene: { zones: [], at: {}, picture: { id: 'x', mime: 'image/svg+xml' } }
		};
		expect(migrateTable(odd as never).scene.picture).toBeNull();
	});
});
