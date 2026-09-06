import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadPackFile } from '../../../packs/fs-loader';
import { deckSchema } from '../pack-schemas';
import {
	TABLE_SCHEMA_VERSION,
	addSeat,
	buildDecks,
	createTable,
	migrateTable,
	removeSeat,
	type DeckDefinition
} from './table';
import { seatZone } from './zones';

const packRoot = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'..',
	'..',
	'..',
	'static',
	'content-packs',
	'hmtw'
);

let deck: DeckDefinition;
beforeAll(async () => {
	deck = deckSchema.parse(await loadPackFile(packRoot, 'data/deck.json'));
});

describe('buildDecks', () => {
	it('splits the real pack the way ch.1 splits the decks', () => {
		const decks = buildDecks(deck);
		// Fifty-six minors plus the Fool, borrowed from the majors.
		expect(decks.player).toHaveLength(57);
		expect(decks.player).toContain('fool');
		// Which leaves the GM the majors I-XXI, without it.
		expect(decks.gm).toHaveLength(21);
		expect(decks.gm).not.toContain('fool');
	});

	it('deals every card exactly once across the two decks', () => {
		const decks = buildDecks(deck);
		const all = [...decks.player, ...decks.gm];
		expect(new Set(all).size).toBe(all.length);
		expect(all).toHaveLength(78);
	});
});

describe('createTable', () => {
	it('stocks both draw piles and leaves the discards empty', () => {
		const table = createTable(deck);
		expect(table.zones['deck:player'].cards).toHaveLength(57);
		expect(table.zones['deck:gm'].cards).toHaveLength(21);
		expect(table.zones['discard:player'].cards).toEqual([]);
		expect(table.zones['discard:gm'].cards).toEqual([]);
	});

	it('does not shuffle — that needs a seed the caller owns', () => {
		expect(createTable(deck).zones['deck:player'].cards).toEqual(buildDecks(deck).player);
	});

	it('hides the draw piles and shows the discards', () => {
		const table = createTable(deck);
		expect(table.zones['deck:player'].visibility).toBe('hidden');
		expect(table.zones['discard:player'].visibility).toBe('public');
	});

	it('gives each seat its zones, with the book’s caps', () => {
		const table = createTable(deck, ['s1', 's2']);
		expect(table.seats).toEqual(['s1', 's2']);
		expect(table.zones[seatZone('s1', 'hand')].visibility).toBe('owner');
		// One initiative card per round; one inspiration card ever.
		expect(table.zones[seatZone('s1', 'initiative')].capacity).toBe(1);
		expect(table.zones[seatZone('s1', 'durable')].capacity).toBe(1);
		// A durable card is held in the open — the table knows who has one.
		expect(table.zones[seatZone('s1', 'durable')].visibility).toBe('public');
		expect(table.zones[seatZone('s2', 'hand')].owner).toBe('s2');
	});
});

describe('seats', () => {
	it('adds a seat with its zones, and is idempotent', () => {
		const table = addSeat(createTable(deck), 's1');
		expect(table.zones[seatZone('s1', 'hand')]).toBeDefined();
		expect(addSeat(table, 's1')).toBe(table);
	});

	it('removes a seat and its zones, leaving other seats alone', () => {
		const table = removeSeat(createTable(deck, ['s1', 's2']), 's1');
		expect(table.seats).toEqual(['s2']);
		expect(table.zones[seatZone('s1', 'hand')]).toBeUndefined();
		expect(table.zones[seatZone('s2', 'hand')]).toBeDefined();
		// Table zones survive.
		expect(table.zones['deck:player']).toBeDefined();
	});
});

describe('migrateTable', () => {
	it('stamps the current version on a current blob', () => {
		expect(migrateTable(createTable(deck)).schemaVersion).toBe(TABLE_SCHEMA_VERSION);
	});

	it('leaves a blob from a newer build alone rather than relabelling it', () => {
		// A rollback, or a stale worker. Silently claiming this is v1 would be
		// worse than the mismatch: the caller can see a version it does not know.
		const future = { ...createTable(deck), schemaVersion: TABLE_SCHEMA_VERSION + 1 };
		expect(migrateTable(future).schemaVersion).toBe(TABLE_SCHEMA_VERSION + 1);
	});
});
