/**
 * The game's side of the card-table slot. The points of interest: the shell's
 * seat list is the authority; a command names a card only where the asker may
 * see it; and no event ever carries a card.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPackFile } from '../../packs/fs-loader';
import { hmtwCardTable } from './card-table';
import { seededRng } from './engine';
import type { CardTable } from './engine';

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'hmtw'
);

let pack: Record<string, unknown>;
beforeAll(async () => {
	pack = {
		'data/deck.json': await loadPackFile(packRoot, 'data/deck.json'),
		'data/challenge.json': await loadPackFile(packRoot, 'data/challenge.json')
	};
});

// Seeded, so a test can assert an exact deal — the shuffle itself is tested
// where it lives, and here it only has to be *a* shuffle.
const fresh = () => hmtwCardTable.create(pack, seededRng(2)).state as CardTable;
const ctx = (actorSeatId: string | null = null) => ({ actorSeatId, rng: seededRng(7) });

describe('creating and migrating', () => {
	it('deals a real deck from the real pack', () => {
		const table = fresh();
		expect(table.zones['deck:player'].cards).toHaveLength(57);
		expect(table.zones['deck:gm'].cards).toHaveLength(21);
	});

	it('reseeds what an old blob could not carry', () => {
		// `foolCards` is derived from the deck definition, which was never stored,
		// so migration alone cannot recover it — the pack does.
		const stale = { ...fresh(), schemaVersion: 1, foolCards: [] } as unknown as CardTable;
		const migrated = hmtwCardTable.migrate(stale, pack).state as CardTable;
		expect(migrated.foolCards).toEqual(['fool']);
	});
});

describe('the shell owns the seat list', () => {
	it('adds seats it is told about and drops ones it is not', () => {
		let state = hmtwCardTable.syncSeats(fresh(), [
			{ id: 's1', isGm: false },
			{ id: 's2', isGm: true }
		]) as CardTable;
		expect(state.seats).toEqual(['s1', 's2']);
		expect(state.gmSeat).toBe('s2');

		state = hmtwCardTable.syncSeats(state, [{ id: 's1', isGm: false }]) as CardTable;
		expect(state.seats).toEqual(['s1']);
		expect(state.zones['seat:s2:hand']).toBeUndefined();
		expect(state.gmSeat).toBeNull();
	});

	it('is idempotent, since it runs on every request', () => {
		const seats = [{ id: 's1', isGm: true }];
		const once = hmtwCardTable.syncSeats(fresh(), seats);
		const twice = hmtwCardTable.syncSeats(once, seats);
		expect(twice).toEqual(once);
	});
});

describe('commands', () => {
	const table = () => hmtwCardTable.syncSeats(fresh(), [{ id: 's1', isGm: false }]) as CardTable;

	it('moves a card, and says only where it went', () => {
		const out = hmtwCardTable.reduce(
			table(),
			{ type: 'move', from: { zone: 'deck:player' }, to: 'discard:player' },
			ctx('s1')
		);
		expect(out.ok).toBe(true);
		if (!out.ok) return;
		expect(out.kind).toBe('move');
		// Zones, never the card: an event is shown to the whole table.
		expect(out.data).toEqual({ from: 'deck:player', to: 'discard:player', seat: 's1' });
		expect(JSON.stringify(out.data)).not.toMatch(/swords|cups|wands|pentacles|fool/);
	});

	it('refuses a card named where the asker cannot see it', () => {
		const out = hmtwCardTable.reduce(
			table(),
			{ type: 'move', from: { zone: 'deck:player', card: 'swords-ace' }, to: 'discard:player' },
			ctx('s1')
		);
		expect(out).toEqual({ ok: false, reason: 'card-named-in-private-zone' });
	});

	it('rejects a command it does not recognise', () => {
		expect(hmtwCardTable.reduce(table(), { type: 'nope' }, ctx())).toEqual({
			ok: false,
			reason: 'malformed-command'
		});
		expect(hmtwCardTable.reduce(table(), null, ctx())).toEqual({
			ok: false,
			reason: 'malformed-command'
		});
	});

	it('shuffles without saying anything about the order', () => {
		const start = table();
		const out = hmtwCardTable.reduce(start, { type: 'reshuffle', deck: 'player' }, ctx('s1'));
		expect(out.ok).toBe(true);
		if (!out.ok) return;
		// The event must give away nothing: the order is the secret, and anything
		// derived from it is the order.
		expect(out.data).toEqual({ deck: 'player', seat: 's1' });
		expect((out.state as CardTable).zones['deck:player'].cards).not.toEqual(
			start.zones['deck:player'].cards
		);
	});

	it('is pure — a discarded result leaves the input alone', () => {
		// The shell throws the result away when a write loses its race.
		const start = table();
		const before = JSON.stringify(start);
		hmtwCardTable.reduce(start, { type: 'reshuffle', deck: 'gm' }, ctx('s1'));
		expect(JSON.stringify(start)).toBe(before);
	});
});

describe('projection', () => {
	it('hands a seat its own hand and nobody else’s', () => {
		let state = hmtwCardTable.syncSeats(fresh(), [
			{ id: 's1', isGm: false },
			{ id: 's2', isGm: false }
		]) as CardTable;
		const dealt = hmtwCardTable.reduce(
			state,
			{ type: 'move', from: { zone: 'deck:player' }, to: 'seat:s2:hand' },
			ctx('s1')
		);
		if (!dealt.ok) return;
		state = dealt.state as CardTable;

		const mine = hmtwCardTable.project(state, 's2') as {
			zones: Record<string, { cards?: string[] }>;
		};
		const theirs = hmtwCardTable.project(state, 's1') as {
			zones: Record<string, { cards?: string[] }>;
		};
		expect(mine.zones['seat:s2:hand'].cards).toHaveLength(1);
		expect(theirs.zones['seat:s2:hand'].cards).toBeUndefined();
	});

	it('gives somebody with no seat the public table only', () => {
		const view = hmtwCardTable.project(fresh(), null) as {
			zones: Record<string, { cards?: string[] }>;
		};
		expect(view.zones['deck:player'].cards).toBeUndefined();
		expect(view.zones['discard:player'].cards).toEqual([]);
	});
});

describe('the Challenge', () => {
	const seated = () =>
		hmtwCardTable.syncSeats(fresh(), [
			{ id: 'p1', isGm: false },
			{ id: 'gm', isGm: true }
		]) as CardTable;

	const run = (t: CardTable, command: unknown, actor = 'gm') => {
		const out = hmtwCardTable.reduce(t, command, { actorSeatId: actor, rng: seededRng(4) });
		if (!out.ok) throw new Error(out.reason);
		return out;
	};

	it('shares one pair of decks across both views', () => {
		// The requirement the modes exist to satisfy: switching does not reset a
		// pile, because the deck is table state and the modes are views onto it.
		let t = seated();
		t = run(t, { type: 'move', from: { zone: 'deck:player' }, to: 'discard:player' })
			.state as CardTable;
		const before = t.zones['deck:player'].cards.length;

		t = run(t, { type: 'set-mode', mode: 'challenge' }).state as CardTable;
		expect(t.zones['deck:player'].cards).toHaveLength(before);
		expect(t.zones['discard:player'].cards).toHaveLength(1);
	});

	it('sweeps the table when the Challenge ends, sparing inspiration', () => {
		let t = run(seated(), { type: 'set-mode', mode: 'challenge' }).state as CardTable;
		t = run(t, { type: 'begin-round', playerHand: 4, gmHand: 3 }).state as CardTable;
		// An inspiration card in play, carried into the fight.
		const withDurable = run(t, {
			type: 'move',
			from: { zone: 'deck:player' },
			to: 'seat:p1:durable'
		}).state as CardTable;

		const after = run(withDurable, { type: 'set-mode', mode: 'decks' }).state as CardTable;
		expect(after.zones['seat:p1:hand'].cards).toEqual([]);
		expect(after.zones['seat:gm:hand'].cards).toEqual([]);
		// "lasts until used or until the end of the session" — not the end of a fight.
		expect(after.zones['seat:p1:durable'].cards).toHaveLength(1);
		expect(after.round.number).toBe(0);
	});

	it('deals four and the GM’s own number, from the right decks', () => {
		let t = run(seated(), { type: 'set-mode', mode: 'challenge' }).state as CardTable;
		const out = run(t, { type: 'begin-round', playerHand: 4, gmHand: 6 });
		t = out.state as CardTable;
		expect(t.zones['seat:p1:hand'].cards).toHaveLength(4);
		expect(t.zones['seat:gm:hand'].cards).toHaveLength(6);
		// Counts are table knowledge; cards are not.
		expect(out.data).toEqual({ round: 1, playerHand: 4, gmHand: 6 });
		expect(JSON.stringify(out.data)).not.toMatch(/swords|cups|wands|pentacles/);
	});

	it('sweeps played cards but leaves facedown ones, which have not happened yet', () => {
		let t = run(seated(), { type: 'set-mode', mode: 'challenge' }).state as CardTable;
		t = run(t, { type: 'begin-round', playerHand: 4, gmHand: 0 }).state as CardTable;
		t = run(t, { type: 'move', from: { zone: 'seat:p1:hand' }, to: 'seat:p1:played' }, 'p1')
			.state as CardTable;
		t = run(
			t,
			{
				type: 'place-facedown',
				holder: 'p1',
				from: { zone: 'seat:p1:hand' },
				position: 'turn',
				label: 'Dodge'
			},
			'p1'
		).state as CardTable;

		t = run(t, { type: 'sweep' }).state as CardTable;
		expect(t.zones['seat:p1:played'].cards).toEqual([]);
		expect(t.zones['seat:p1:facedown'].cards).toHaveLength(1);
	});

	it('says what a facedown card is for, and never which card it is', () => {
		let t = run(seated(), { type: 'set-mode', mode: 'challenge' }).state as CardTable;
		t = run(t, { type: 'begin-round', playerHand: 4, gmHand: 0 }).state as CardTable;
		const out = run(
			t,
			{
				type: 'place-facedown',
				holder: 'p1',
				from: { zone: 'seat:p1:hand' },
				position: 'minor',
				label: 'Riposte'
			},
			'p1'
		);
		expect(out.data).toEqual({ holder: 'p1', position: 'minor', label: 'Riposte' });
		expect(JSON.stringify(out.data)).not.toMatch(/swords|cups|wands|pentacles/);
	});

	it('counts up without stopping at the king', () => {
		let t = run(seated(), { type: 'set-count', count: 14 }).state as CardTable;
		t = run(t, { type: 'advance-count' }).state as CardTable;
		expect(t.round.count).toBe(15);
		t = run(t, { type: 'rewind-count' }).state as CardTable;
		expect(t.round.count).toBe(14);
	});

	it('keeps opponents, and lets the GM name them', () => {
		let t = run(seated(), { type: 'set-mode', mode: 'challenge' }).state as CardTable;
		t = run(t, { type: 'add-opponent', id: 'imps', name: 'Imps', count: 12 }).state as CardTable;
		expect(t.opponents[0].creatures).toHaveLength(12);
		t = run(t, { type: 'update-opponent', id: 'imps', name: 'Surviving imps' }).state as CardTable;
		expect(t.opponents[0].name).toBe('Surviving imps');
		// How many there are is the creatures, not a number to edit.
		const recount = hmtwCardTable.reduce(
			t,
			{ type: 'update-opponent', id: 'imps', count: 7 },
			{ actorSeatId: 'gm', rng: seededRng(4) }
		);
		expect(recount.ok).toBe(false);
		t = run(t, { type: 'remove-opponent', id: 'imps' }).state as CardTable;
		expect(t.opponents).toEqual([]);
	});
});

describe('the scene and its creatures', () => {
	const seated = () =>
		hmtwCardTable.syncSeats(fresh(), [
			{ id: 'regan', isGm: false },
			{ id: 'gm', isGm: true }
		]) as CardTable;
	const reduce = (t: CardTable, command: unknown, actor = 'gm') =>
		hmtwCardTable.reduce(t, command, { actorSeatId: actor, rng: seededRng(4) });
	const run = (t: CardTable, command: unknown, actor = 'gm') => {
		const out = reduce(t, command, actor);
		if (!out.ok) throw new Error(out.reason);
		return out;
	};
	/** Session 11: the Arena, the King's Pillar, and two zombies at HD 1/0. */
	const arena = () => {
		let t = run(seated(), {
			type: 'set-scene-zones',
			zones: [
				{ id: 'arena', name: 'Arena' },
				{ id: 'pillar', name: "King's Pillar" }
			]
		}).state as CardTable;
		t = run(t, {
			type: 'add-opponent',
			id: 'zombies',
			name: 'Zombie',
			count: 2,
			health: 1,
			defense: 0
		}).state as CardTable;
		return t;
	};
	const zombie = (t: CardTable, letter: string) =>
		t.opponents.flatMap((o) => o.creatures).find((c) => c.letter === letter)!.id;

	it('lets only the GM name the zones or clear the scene', () => {
		const zones = { type: 'set-scene-zones', zones: [{ id: 'a', name: 'Arena' }] };
		expect(reduce(seated(), zones, 'regan')).toEqual({ ok: false, reason: 'gm-only' });
		expect(reduce(arena(), { type: 'clear-scene' }, 'regan')).toEqual({
			ok: false,
			reason: 'gm-only'
		});
		const out = run(arena(), { type: 'clear-scene' });
		expect((out.state as CardTable).scene.zones).toEqual([]);
	});

	it('lets the GM place anyone, and logs the zone by name', () => {
		const t = arena();
		const out = run(t, { type: 'place', who: zombie(t, 'A'), zone: 'pillar' });
		expect(out.data).toEqual({ who: zombie(t, 'A'), label: 'Zombie A', zone: "King's Pillar" });
	});

	it('lets a player place themselves, and nobody else', () => {
		// The first live test: players could move each other's zones.
		const t = arena();
		const seat = run(t, { type: 'place', who: 'regan', zone: 'arena' }, 'regan');
		expect(seat.data).toEqual({ who: 'regan', seat: 'regan', zone: 'Arena' });
		expect(reduce(t, { type: 'place', who: zombie(t, 'A'), zone: 'pillar' }, 'regan')).toEqual({
			ok: false,
			reason: 'not-yours'
		});
	});

	it('refuses a place for nobody, a zone that is not there, or the GM', () => {
		const t = arena();
		expect(reduce(t, { type: 'place', who: 'nobody', zone: 'arena' }).ok).toBe(false);
		expect(reduce(t, { type: 'place', who: 'regan', zone: 'balcony' }).ok).toBe(false);
		expect(reduce(t, { type: 'place', who: 'gm', zone: 'arena' }).ok).toBe(false);
	});

	it('adds a group with HD, then reinforcements lettered on', () => {
		const out = run(arena(), { type: 'add-creatures', id: 'zombies', count: 2 });
		expect(out.data).toEqual({ labels: ['Zombie C', 'Zombie D'] });
		const t = out.state as CardTable;
		expect(t.opponents[0].creatures[3].pools[0]).toMatchObject({ health: 1, healthMax: 1 });
	});

	it('changes HD from what the asker saw, and refuses a stale change', () => {
		const t = arena();
		const hit = {
			type: 'set-hd',
			creature: zombie(t, 'B'),
			pool: 0,
			stat: 'health',
			from: 1,
			to: 0
		};
		const out = run(t, hit, 'regan');
		expect(out.data).toEqual({ label: 'Zombie B', stat: 'health', value: 0, max: 1 });
		expect(reduce(out.state as CardTable, hit, 'regan')).toEqual({ ok: false, reason: 'stale' });
	});

	it('marks a creature down and back up', () => {
		const t = arena();
		const down = run(t, { type: 'set-down', creature: zombie(t, 'A'), down: true }, 'regan');
		expect(down.data).toEqual({ label: 'Zombie A', down: true });
		expect((down.state as CardTable).opponents[0].creatures[0].down).toBe(true);
	});

	it('lets only the GM split and merge, and merges back to one group', () => {
		const t = arena();
		const split = {
			type: 'split-opponent',
			id: 'zombies',
			newId: 'raised',
			creatures: [zombie(t, 'B')]
		};
		expect(reduce(t, split, 'regan')).toEqual({ ok: false, reason: 'gm-only' });
		const out = run(t, split);
		expect(out.data).toEqual({ labels: ['Zombie B'] });
		const merged = run(out.state as CardTable, { type: 'merge-opponent', id: 'raised' });
		expect((merged.state as CardTable).opponents).toHaveLength(1);
		expect(reduce(merged.state as CardTable, { type: 'merge-opponent', id: 'zombies' }).ok).toBe(
			false
		);
	});

	it('calls a lone enemy by its name, without a letter', () => {
		let t = run(arena(), { type: 'add-opponent', id: 'king', name: 'King of Swords', count: 1 })
			.state as CardTable;
		const king = t.opponents[1].creatures[0].id;
		t = run(t, { type: 'set-scene-zones', zones: [{ id: 'arena', name: 'Arena' }] })
			.state as CardTable;
		const out = run(t, { type: 'place', who: king, zone: 'arena' });
		expect(out.data).toMatchObject({ label: 'King of Swords' });
	});

	it('puts no card in any of these events', () => {
		// The public-log contract: these events carry names, zones and numbers.
		const t = arena();
		const events = [
			run(t, { type: 'place', who: zombie(t, 'A'), zone: 'arena' }),
			run(t, { type: 'set-down', creature: zombie(t, 'A'), down: true }),
			run(t, { type: 'add-creatures', id: 'zombies', count: 1 })
		];
		const cards = new Set(Object.keys(t.deckOf));
		for (const e of events) {
			for (const value of JSON.stringify(e.data).match(/"[^"]*"/g) ?? []) {
				expect(cards.has(value.slice(1, -1))).toBe(false);
			}
		}
	});
});

/**
 * The first live test (25 November 2026) found GM cards in the Player
 * discard: the sweeps chose a discard by whose spot a card was in. Every way
 * cards leave the table is run here with both decks' cards in every kind of
 * spot, and two things must hold after each: every card still exists exactly
 * once, and no discard holds the other deck's card.
 */
describe('every card goes to its own deck’s discard', () => {
	const seats = [
		{ id: 'p1', isGm: false },
		{ id: 'p2', isGm: false },
		{ id: 'gm', isGm: true }
	];
	const run = (t: CardTable, command: unknown, actor = 'gm') => {
		const out = hmtwCardTable.reduce(t, command, { actorSeatId: actor, rng: seededRng(4) });
		if (!out.ok) throw new Error(`${JSON.stringify(command)}: ${out.reason}`);
		return out.state as CardTable;
	};
	const TOTAL = 78;

	function holds(t: CardTable) {
		const cards = Object.values(t.zones).flatMap((z) => z.cards);
		expect(cards).toHaveLength(TOTAL);
		expect(new Set(cards).size).toBe(TOTAL);
		for (const deck of ['player', 'gm'] as const) {
			for (const card of t.zones[`discard:${deck}`].cards) {
				expect(t.deckOf[card], `${card} in the ${deck} discard`).toBe(deck);
			}
		}
	}

	/** A Challenge mid-round with majors and minors crossed over everywhere. */
	function crossed(): CardTable {
		let t = hmtwCardTable.syncSeats(fresh(), seats) as CardTable;
		t = run(t, { type: 'set-mode', mode: 'challenge' });
		t = run(t, { type: 'add-opponent', id: 'zombies', name: 'Zombie', count: 3 });
		t = run(t, { type: 'begin-round', playerHand: 4, gmHand: 5 });
		// The GM plays a major in front of a player, and onto the zombies.
		t = run(t, { type: 'move', from: { zone: 'seat:gm:hand' }, to: 'seat:p1:played' });
		t = run(t, { type: 'move', from: { zone: 'seat:gm:hand' }, to: 'opponent:zombies:initiative' });
		// A player's minor, moved by the GM onto the zombies' played pile; and a
		// player's own initiative.
		t = run(t, { type: 'move', from: { zone: 'seat:p1:hand' }, to: 'seat:p1:played' }, 'p1');
		t = run(t, { type: 'move', from: { zone: 'seat:p1:played' }, to: 'opponent:zombies:played' });
		t = run(t, { type: 'move', from: { zone: 'seat:p2:hand' }, to: 'seat:p2:initiative' }, 'p2');
		// A major as a player's facedown card.
		t = run(t, {
			type: 'place-facedown',
			holder: 'gm',
			from: { zone: 'seat:gm:hand' },
			position: 'minor',
			label: 'Dodge'
		});
		holds(t);
		return t;
	}

	it('on the Sweep', () => holds(run(crossed(), { type: 'sweep' })));
	it('at the end of the round', () => holds(run(crossed(), { type: 'end-round' })));
	it('on leaving the Challenge', () => holds(run(crossed(), { type: 'set-mode', mode: 'decks' })));
	it('on Reset', () => holds(run(crossed(), { type: 'reset-table' })));
	it('on the mulligan', () => holds(run(crossed(), { type: 'mulligan' })));
	it('when a facedown card is given up', () =>
		holds(run(crossed(), { type: 'clear-facedown', holder: 'gm' })));
	it('when an enemy group is removed with cards on it', () =>
		holds(run(crossed(), { type: 'remove-opponent', id: 'zombies' })));
	it('when a seat leaves holding cards', () => {
		const t = hmtwCardTable.syncSeats(crossed(), [seats[1], seats[2]]) as CardTable;
		expect(t.seats).not.toContain('p1');
		holds(t);
	});

	it('when a Test of Fate turned over both decks', () => {
		let t = hmtwCardTable.syncSeats(fresh(), seats) as CardTable;
		t = run(t, { type: 'move', from: { zone: 'deck:gm' }, to: 'fate' }, 'p1');
		t = run(t, { type: 'move', from: { zone: 'deck:player' }, to: 'fate' }, 'p1');
		t = run(t, { type: 'clear-fate' }, 'p1');
		holds(t);
		expect(t.zones['discard:gm'].cards).toHaveLength(1);
		expect(t.zones['discard:player'].cards).toHaveLength(1);
	});
});

describe('the Fool’s reshuffle', () => {
	const seats = [
		{ id: 'p1', isGm: false },
		{ id: 'gm', isGm: true }
	];
	const run = (t: CardTable, command: unknown, actor = 'gm') => {
		const out = hmtwCardTable.reduce(t, command, { actorSeatId: actor, rng: seededRng(4) });
		if (!out.ok) throw new Error(`${JSON.stringify(command)}: ${out.reason}`);
		return out;
	};

	it('happens when a Challenge is left mid-round, not only at the end of one', () => {
		let t = hmtwCardTable.syncSeats(fresh(), seats) as CardTable;
		t = run(t, { type: 'set-mode', mode: 'challenge' }).state as CardTable;
		t = run(t, { type: 'begin-round', playerHand: 4, gmHand: 3 }).state as CardTable;
		t = { ...t, round: { ...t.round, foolDrawn: true } };
		const before = t.zones['deck:player'].cards.length;
		const left = run(t, { type: 'set-mode', mode: 'decks' }).state as CardTable;
		// Hands went to the discard and the discard was shuffled back in.
		expect(left.zones['discard:player'].cards).toHaveLength(0);
		expect(left.zones['deck:player'].cards.length).toBeGreaterThan(before);
	});

	it('is announced when the round ends', () => {
		let t = hmtwCardTable.syncSeats(fresh(), seats) as CardTable;
		t = run(t, { type: 'set-mode', mode: 'challenge' }).state as CardTable;
		t = run(t, { type: 'begin-round', playerHand: 4, gmHand: 3 }).state as CardTable;
		t = { ...t, round: { ...t.round, foolDrawn: false } };
		const quiet = run(t, { type: 'end-round' });
		expect(quiet.ok && quiet.data).toMatchObject({ shuffled: false });
		t = { ...t, round: { ...t.round, foolDrawn: true } };
		const loud = run(t, { type: 'end-round' });
		expect(loud.ok && loud.data).toMatchObject({ shuffled: true });
	});
});

describe('a draw from an empty deck', () => {
	const run = (t: CardTable, command: unknown, actor = 'p1') => {
		const out = hmtwCardTable.reduce(t, command, { actorSeatId: actor, rng: seededRng(4) });
		if (!out.ok) throw new Error(`${JSON.stringify(command)}: ${out.reason}`);
		return out;
	};

	it('shuffles the discard back in first, so a Test of Fate never just fails', () => {
		let t = hmtwCardTable.syncSeats(fresh(), [
			{ id: 'p1', isGm: false },
			{ id: 'gm', isGm: true }
		]) as CardTable;
		// Everything in the GM deck to its discard.
		while (t.zones['deck:gm'].cards.length > 0) {
			t = run(t, { type: 'move', from: { zone: 'deck:gm' }, to: 'discard:gm' }).state as CardTable;
		}
		const out = run(t, { type: 'move', from: { zone: 'deck:gm' }, to: 'fate' });
		const after = out.state as CardTable;
		expect(after.zones.fate.cards).toHaveLength(1);
		expect(after.zones['deck:gm'].cards).toHaveLength(20);
		expect(after.zones['discard:gm'].cards).toHaveLength(0);
		expect(out.ok && out.data).toMatchObject({ reshuffled: true });
	});

	it('says nothing about shuffling when the deck had cards', () => {
		const t = hmtwCardTable.syncSeats(fresh(), [{ id: 'p1', isGm: false }]) as CardTable;
		const out = run(t, { type: 'move', from: { zone: 'deck:player' }, to: 'fate' });
		expect(out.ok && out.data).not.toHaveProperty('reshuffled');
	});
});

describe('the end-of-round check', () => {
	const seats = [
		{ id: 'p1', isGm: false },
		{ id: 'gm', isGm: true }
	];
	const run = (t: CardTable, command: unknown, actor = 'gm') => {
		const out = hmtwCardTable.reduce(t, command, { actorSeatId: actor, rng: seededRng(4) });
		if (!out.ok) throw new Error(`${JSON.stringify(command)}: ${out.reason}`);
		return out.state as CardTable;
	};
	const done = (t: CardTable, viewer = 'p1') =>
		(hmtwCardTable.project(t, viewer) as { roundDone: boolean }).roundDone;

	function atLastNumber() {
		let t = hmtwCardTable.syncSeats(fresh(), seats) as CardTable;
		t = run(t, { type: 'set-mode', mode: 'challenge' });
		t = run(t, { type: 'begin-round', playerHand: 4, gmHand: 3 });
		t = run(t, { type: 'move', from: { zone: 'seat:p1:hand' }, to: 'seat:p1:initiative' }, 'p1');
		const card = t.zones['seat:p1:initiative'].cards[0];
		return run(t, { type: 'set-count', count: t.valueOf[card] });
	}

	it('comes when the GM sweeps instead of closing minor actions', () => {
		const t = run(atLastNumber(), { type: 'minor-actions', open: true });
		expect(done(t)).toBe(false);
		expect(done(run(t, { type: 'sweep' }))).toBe(true);
	});

	it('comes when the GM counts on past the last card', () => {
		const t = atLastNumber();
		expect(done(t)).toBe(false);
		expect(done(run(t, { type: 'advance-count' }))).toBe(true);
	});
});

describe('who may do what', () => {
	const seats = [
		{ id: 'p1', isGm: false },
		{ id: 'p2', isGm: false },
		{ id: 'gm', isGm: true }
	];
	const reduce = (t: CardTable, command: unknown, actor: string) =>
		hmtwCardTable.reduce(t, command, { actorSeatId: actor, rng: seededRng(4) });
	const table = () => {
		let t = hmtwCardTable.syncSeats(fresh(), seats) as CardTable;
		for (const command of [
			{ type: 'set-mode', mode: 'challenge' },
			{ type: 'add-opponent', id: 'zombies', name: 'Zombie', count: 2 },
			{ type: 'begin-round', playerHand: 4, gmHand: 3 }
		]) {
			const out = reduce(t, command, 'gm');
			if (!out.ok) throw new Error(out.reason);
			t = out.state as CardTable;
		}
		return t;
	};

	// The first live test: a player could deal, move the count, shuffle, or
	// redraw the GM's hand, because only a few commands were checked.
	const gmOnly = [
		{ type: 'reshuffle', deck: 'player' },
		{ type: 'guided', on: true },
		{ type: 'set-mode', mode: 'decks' },
		{ type: 'begin-round', playerHand: 4, gmHand: 3 },
		{ type: 'end-round' },
		{ type: 'mulligan' },
		{ type: 'set-count', count: 3 },
		{ type: 'advance-count' },
		{ type: 'rewind-count' },
		{ type: 'minor-actions', open: true },
		{ type: 'sweep' },
		{ type: 'add-opponent', id: 'imps', name: 'Imp', count: 1 },
		{ type: 'remove-opponent', id: 'zombies' },
		{ type: 'update-opponent', id: 'zombies', name: 'Ghoul' },
		{ type: 'add-creatures', id: 'zombies', count: 1 },
		{ type: 'remove-creature', creature: 'zombies:B' },
		{ type: 'set-scene-zones', zones: [{ id: 'z1', name: 'Nave' }] },
		{ type: 'clear-scene' },
		{ type: 'reset-table' }
	];

	for (const command of gmOnly) {
		it(`keeps ${command.type} to the GM`, () => {
			const t = table();
			expect(reduce(t, command, 'p1')).toEqual({ ok: false, reason: 'gm-only' });
			expect(reduce(t, command, 'gm').ok).toBe(true);
		});
	}

	it('keeps a facedown slot to its holder and the GM', () => {
		const t = table();
		const lay = (holder: string, actor: string) =>
			reduce(
				t,
				{
					type: 'place-facedown',
					holder,
					from: { zone: `seat:${actor}:hand` },
					position: 'turn',
					label: 'Dodge'
				},
				actor
			);
		expect(lay('p2', 'p1')).toEqual({ ok: false, reason: 'not-yours' });
		expect(lay('p1', 'p1').ok).toBe(true);
		expect(reduce(t, { type: 'clear-facedown', holder: 'p1' }, 'p2')).toEqual({
			ok: false,
			reason: 'not-yours'
		});
	});

	it('lets a player play only in front of themselves', () => {
		const t = table();
		const play = (to: string) =>
			reduce(t, { type: 'move', from: { zone: 'seat:p1:hand' }, to }, 'p1');
		expect(play('seat:p1:played').ok).toBe(true);
		expect(play('seat:p1:initiative').ok).toBe(true);
		expect(play('seat:p2:played')).toEqual({ ok: false, reason: 'not-yours' });
		expect(play('opponent:zombies:played')).toEqual({ ok: false, reason: 'not-yours' });
		expect(play('discard:player').ok).toBe(true);
	});

	it('runs open for everyone while nobody holds the GM seat', () => {
		let t = hmtwCardTable.syncSeats(fresh(), [
			{ id: 'p1', isGm: false },
			{ id: 'p2', isGm: false }
		]) as CardTable;
		const out = reduce(t, { type: 'set-mode', mode: 'challenge' }, 'p1');
		if (!out.ok) throw new Error(out.reason);
		t = out.state as CardTable;
		expect(reduce(t, { type: 'begin-round', playerHand: 4, gmHand: 0 }, 'p2').ok).toBe(true);
	});
});
