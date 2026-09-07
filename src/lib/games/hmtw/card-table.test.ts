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

const fresh = () => hmtwCardTable.create(pack).state as CardTable;
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
