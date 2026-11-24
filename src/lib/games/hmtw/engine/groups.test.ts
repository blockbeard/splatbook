import { describe, expect, it } from 'vitest';
import {
	addCreatures,
	findCreature,
	mergeOpponent,
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
	splitOpponent,
	upCount,
	type CardTable,
	type DeckDefinition
} from './table';
import { opponentZone } from './zones';

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

	it('never mint a letter a split-off group already has', () => {
		let t = chapel();
		t = splitOpponent(t, 'monks', { id: 'monks-b', creatures: [id(t, 'E')] });
		t = addCreatures(t, 'monks-b', 1);
		// E is in the split-off group; the next skeleton is F, not a second E.
		expect(letters(t)).toEqual([
			['A', 'B', 'C', 'D'],
			['E', 'F']
		]);
		t = addCreatures(t, 'monks', 1);
		expect(letters(t)[0]).toEqual(['A', 'B', 'C', 'D', 'G']);
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

describe('merging a split back', () => {
	const split = () => {
		const t = chapel();
		return splitOpponent(t, 'monks', { id: 'monks-b', creatures: [id(t, 'B'), id(t, 'D')] });
	};

	it('returns the creatures, in letter order, to the group they left', () => {
		const t = mergeOpponent(split(), 'monks-b');
		expect(letters(t)).toEqual([['A', 'B', 'C', 'D', 'E']]);
		expect(t.zones[opponentZone('monks-b', 'initiative')]).toBeUndefined();
	});

	it('sends the split-off group’s cards to the GM discard, not out of the game', () => {
		const t = split();
		const played = moveCard(t, { zone: 'deck:gm' }, opponentZone('monks-b', 'initiative'));
		if (!played.ok) throw new Error('setup');
		const discardBefore = played.table.zones['discard:gm'].cards.length;
		const merged = mergeOpponent(played.table, 'monks-b');
		expect(merged.zones['discard:gm'].cards).toHaveLength(discardBefore + 1);
	});

	it('keeps the creatures standing where they stood', () => {
		let t = setSceneZones(split(), [{ id: 'niches', name: 'Niches' }]);
		t = placeInScene(t, id(t, 'B', 1), 'niches');
		t = mergeOpponent(t, 'monks-b');
		expect(t.scene.at[id(t, 'B')]).toBe('niches');
	});

	it('rejoins the family when the group it left has gone', () => {
		let t = split();
		t = splitOpponent(t, 'monks-b', { id: 'monks-c', creatures: [id(t, 'D', 1)] });
		t = mergeOpponent(t, 'monks-b');
		// monks-c was split from monks-b, which is gone; it goes home to monks.
		t = mergeOpponent(t, 'monks-c');
		expect(letters(t)).toEqual([['A', 'B', 'C', 'D', 'E']]);
	});

	it('does nothing for a group that was never split, or has nowhere to go', () => {
		const t = chapel();
		expect(mergeOpponent(t, 'monks')).toBe(t);
		const orphaned = removeOpponent(split(), 'monks');
		expect(mergeOpponent(orphaned, 'monks-b')).toBe(orphaned);
	});
});
