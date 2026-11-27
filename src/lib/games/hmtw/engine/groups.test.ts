import { describe, expect, it } from 'vitest';
import {
	addCreatures,
	findCreature,
	nameCreature,
	rejoinSplitGroups,
	removeCreature,
	setDown,
	setHd
} from './groups';
import { moveCard } from './moves';
import { placeInScene, setSceneZones } from './scene';
import {
	addOpponent,
	createTable,
	removeOpponent,
	upCount,
	type CardTable,
	type DeckDefinition
} from './table';
import { opponentZone, opponentZones } from './zones';
import { creatureLabel, migrateCreature } from './creatures';

const deck: DeckDefinition = {
	minors: [{ id: 'm1', value: 1 }],
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

/** Session 10's chapel: five skeletons, HD 6/0, one shared initiative. */
const chapel = (): CardTable =>
	addOpponent(createTable(deck, ['gm', 'regan']), {
		id: 'monks',
		name: 'Skeleton',
		count: 5,
		health: 6,
		defense: 0
	});
const id = (t: CardTable, letter: string, group = 0) =>
	t.opponents[group].creatures.find((c) => c.letter === letter)!.id;
const letters = (t: CardTable) => t.opponents.map((o) => o.creatures.map((c) => c.letter));

describe('reinforcements', () => {
	it('letter on from the family’s last letter, as fresh as the first wave', () => {
		const t = addCreatures(chapel(), 'monks', 2);
		expect(letters(t)).toEqual([['A', 'B', 'C', 'D', 'E', 'F', 'G']]);
		expect(t.opponents[0].creatures[6].pools[0]).toEqual({
			health: 6,
			healthMax: 6,
			defense: 0,
			defenseMax: 0
		});
	});

	it('stop at the fifty-second letter', () => {
		let t = addOpponent(createTable(deck), { id: 'rats', name: 'Rat', count: 50 });
		t = addCreatures(t, 'rats', 10);
		expect(t.opponents[0].creatures).toHaveLength(52);
		expect(addCreatures(t, 'rats', 1)).toBe(t);
	});
});

describe('Health and Defense', () => {
	it('change from the value the caller saw', () => {
		const out = setHd(chapel(), id(chapel(), 'B'), { pool: 0, stat: 'health', from: 6, to: 4 });
		expect(out.ok).toBe(true);
		if (!out.ok) return;
		expect(findCreature(out.table, id(out.table, 'B'))?.creature.pools[0].health).toBe(4);
		// Nobody else was touched.
		expect(findCreature(out.table, id(out.table, 'A'))?.creature.pools[0].health).toBe(6);
	});

	it('refuse the second of two people applying the same hit', () => {
		const t = chapel();
		const b = id(t, 'B');
		const first = setHd(t, b, { pool: 0, stat: 'health', from: 6, to: 5 });
		if (!first.ok) throw new Error('first hit should land');
		// The second person saw 6 too. As "−1" it would land twice.
		const second = setHd(first.table, b, { pool: 0, stat: 'health', from: 6, to: 5 });
		expect(second).toEqual({ ok: false, reason: 'stale' });
	});

	it('stay between nothing and full', () => {
		const t = chapel();
		const b = id(t, 'B');
		const over = setHd(t, b, { pool: 0, stat: 'health', from: 6, to: 9 });
		const under = setHd(t, b, { pool: 0, stat: 'health', from: 6, to: -3 });
		expect(over.ok && findCreature(over.table, b)?.creature.pools[0].health).toBe(6);
		expect(under.ok && findCreature(under.table, b)?.creature.pools[0].health).toBe(0);
	});

	it('cannot be changed on a creature or pool that is not there', () => {
		const t = chapel();
		expect(setHd(t, 'nobody', { pool: 0, stat: 'health', from: 6, to: 5 }).ok).toBe(false);
		expect(setHd(t, id(t, 'A'), { pool: 1, stat: 'health', from: 6, to: 5 }).ok).toBe(false);
	});
});

describe('going down', () => {
	it('keeps the creature and its letter, and stops counting it', () => {
		const t = setDown(chapel(), id(chapel(), 'B'), true);
		expect(letters(t)[0]).toEqual(['A', 'B', 'C', 'D', 'E']);
		expect(upCount(t.opponents[0])).toBe(4);
		expect(upCount(setDown(t, id(t, 'B'), false).opponents[0])).toBe(5);
	});

	it('leaves the body where it fell', () => {
		let t = setSceneZones(chapel(), [{ id: 'nave', name: 'Nave' }]);
		t = placeInScene(t, id(t, 'B'), 'nave');
		t = setDown(t, id(t, 'B'), true);
		expect(t.scene.at[id(t, 'B')]).toBe('nave');
	});
});

describe('naming a creature (v21)', () => {
	it('keeps the letter beside the name', () => {
		const t = nameCreature(chapel(), id(chapel(), 'B'), 'Brother Ash');
		expect(creatureLabel(t.opponents, id(t, 'B'))).toBe('Brother Ash (B)');
		expect(creatureLabel(t.opponents, id(t, 'A'))).toBe('Skeleton A');
		expect(letters(t)[0]).toEqual(['A', 'B', 'C', 'D', 'E']);
	});

	it('names a lone creature without a letter nobody said', () => {
		const t = addOpponent(createTable(deck, ['gm']), {
			id: 'king',
			name: 'King of Swords',
			count: 1
		});
		const king = t.opponents[0].creatures[0].id;
		expect(creatureLabel(nameCreature(t, king, 'Grisha').opponents, king)).toBe('Grisha');
	});

	it('tidies the name, takes it away when empty, and ignores no change', () => {
		const t = chapel();
		const named = nameCreature(t, id(t, 'A'), '  Old\tBones  ');
		expect(named.opponents[0].creatures[0].name).toBe('Old Bones');
		expect(nameCreature(named, id(t, 'A'), 'Old Bones')).toBe(named);
		expect(nameCreature(named, id(t, 'A'), ' ').opponents[0].creatures[0]).not.toHaveProperty(
			'name'
		);
		expect(nameCreature(t, 'monks:Q', 'Nobody')).toBe(t);
	});

	it('keeps a stored name, and drops one that is not a string', () => {
		const base = { id: 'x:A', letter: 'A', down: false, pools: [] };
		expect(migrateCreature({ ...base, name: 'Lefty' })?.name).toBe('Lefty');
		expect(migrateCreature({ ...base, name: 7 } as never)).not.toHaveProperty('name');
		expect(migrateCreature(base)).not.toHaveProperty('name');
	});
});

describe('removing a creature added by mistake', () => {
	it('takes it off the table and out of the scene', () => {
		let t = setSceneZones(chapel(), [{ id: 'nave', name: 'Nave' }]);
		const e = id(t, 'E');
		t = placeInScene(t, e, 'nave');
		t = removeCreature(t, e);
		expect(letters(t)[0]).toEqual(['A', 'B', 'C', 'D']);
		expect(e in t.scene.at).toBe(false);
	});

	it('will not empty a group — that is removing the group', () => {
		const t = addOpponent(createTable(deck), { id: 'king', name: 'King of Swords' });
		expect(removeCreature(t, id(t, 'A'))).toBe(t);
	});
});

/**
 * A v13 table with a split-off group, as the removed `splitOpponent` made one:
 * the creatures moved, with their letters, into a group of the same family
 * with its own empty card slots.
 */
function splitV13(t: CardTable, into: string, from: string, moving: string[]): CardTable {
	const source = t.opponents.find((o) => o.id === from)!;
	const zones = { ...t.zones };
	for (const zone of opponentZones(into)) zones[zone.id] = zone;
	return {
		...t,
		zones,
		opponents: [
			...t.opponents.map((o) =>
				o.id === from ? { ...o, creatures: o.creatures.filter((c) => !moving.includes(c.id)) } : o
			),
			{
				id: into,
				name: source.name,
				family: source.family,
				creatures: source.creatures.filter((c) => moving.includes(c.id))
			}
		]
	};
}

describe('rejoining split groups (v13 → v14)', () => {
	const split = () => {
		const t = chapel();
		return splitV13(t, 'monks-b', 'monks', [id(t, 'B'), id(t, 'D')]);
	};

	it('returns the creatures, in letter order, to their family', () => {
		const t = rejoinSplitGroups(split());
		expect(letters(t)).toEqual([['A', 'B', 'C', 'D', 'E']]);
		expect(t.zones[opponentZone('monks-b', 'initiative')]).toBeUndefined();
	});

	it('sends the split-off group’s cards to the GM discard, not out of the game', () => {
		const t = split();
		const played = moveCard(t, { zone: 'deck:gm' }, opponentZone('monks-b', 'initiative'));
		if (!played.ok) throw new Error('setup');
		const discardBefore = played.table.zones['discard:gm'].cards.length;
		const merged = rejoinSplitGroups(played.table);
		expect(merged.zones['discard:gm'].cards).toHaveLength(discardBefore + 1);
	});

	it('keeps the creatures standing where they stood', () => {
		let t = setSceneZones(split(), [{ id: 'niches', name: 'Niches' }]);
		t = placeInScene(t, id(t, 'B', 1), 'niches');
		t = rejoinSplitGroups(t);
		expect(t.scene.at[id(t, 'B')]).toBe('niches');
	});

	it('rejoins several split-off groups of one family', () => {
		let t = split();
		t = splitV13(t, 'monks-c', 'monks-b', [id(t, 'D', 1)]);
		t = rejoinSplitGroups(t);
		expect(letters(t)).toEqual([['A', 'B', 'C', 'D', 'E']]);
	});

	it('leaves an unsplit table alone, and makes an orphan its own family', () => {
		const t = chapel();
		expect(rejoinSplitGroups(t)).toBe(t);
		const orphaned = rejoinSplitGroups(removeOpponent(split(), 'monks'));
		expect(orphaned.opponents).toHaveLength(1);
		expect(orphaned.opponents[0]).toMatchObject({ id: 'monks-b', family: 'monks-b' });
		expect(letters(orphaned)).toEqual([['B', 'D']]);
	});
});
