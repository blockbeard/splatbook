import { describe, it, expect, beforeEach } from 'vitest';
import MiniSearch from 'minisearch';
import { toPlainText, miniSearchOptions, type SearchDoc } from './search-fields';
import {
	loadSearchIndex,
	loadGmSearchIndex,
	clearSearchIndexCache,
	search,
	mergeHits,
	type SearchHit
} from './search';

// The loaders memoise per game (phase 25), and that cache is module state.
beforeEach(clearSearchIndexCache);

describe('toPlainText', () => {
	it('resolves wikilinks to their label and strips markdown', () => {
		expect(toPlainText('See [[06 - Player Moves#DEFY DANGER|Defy Danger]] now.')).toBe(
			'See Defy Danger now.'
		);
		expect(toPlainText('**bold** _em_ `code` > quote')).toBe('bold em code quote');
		expect(toPlainText('a [link](http://x) b')).toBe('a link b');
	});

	it('drops image embeds', () => {
		expect(toPlainText('before ![[map.png]] after')).toBe('before after');
	});

	it('drops a bare block-id line', () => {
		expect(toPlainText('Some text.\n^some-anchor\n\nMore text.')).toBe('Some text. More text.');
	});

	it('drops a block-id line inside a callout', () => {
		expect(toPlainText('> Roll +STR.\n> ^clash\n\nAfter.')).toBe('Roll +STR. After.');
	});

	it('drops the callout marker but keeps its inline title', () => {
		expect(toPlainText('> [!box] **A title**\n> Boxed text.')).toBe('A title Boxed text.');
	});
});

const docs: SearchDoc[] = [
	{
		id: 'defy-danger',
		title: 'DEFY DANGER',
		breadcrumb: 'Player Moves › DEFY DANGER',
		docTitle: 'Book I',
		visibility: 'player',
		body: 'When danger looms and the stakes are high you do something chancy roll'
	},
	{
		id: 'make-camp',
		title: 'MAKE CAMP',
		breadcrumb: 'Harm and Healing › MAKE CAMP',
		docTitle: 'Book I',
		visibility: 'player',
		body: 'When you settle in to rest and recover hit points make camp'
	}
];

function buildIndex(): MiniSearch {
	const mini = new MiniSearch(miniSearchOptions);
	mini.addAll(docs);
	return mini;
}

describe('search', () => {
	it('finds a section by body text', () => {
		const hits = search(buildIndex(), 'chancy');
		expect(hits.map((h) => h.id)).toContain('defy-danger');
	});

	it('boosts a title match and returns display fields', () => {
		const [top] = search(buildIndex(), 'camp');
		expect(top.id).toBe('make-camp');
		expect(top.title).toBe('MAKE CAMP');
		expect(top.breadcrumb).toContain('Harm and Healing');
		expect(top.body).toContain('rest');
	});

	it('returns nothing for an empty query', () => {
		expect(search(buildIndex(), '   ')).toEqual([]);
	});

	it('round-trips through serialize + loadSearchIndex', async () => {
		const json = JSON.stringify(buildIndex());
		const fakeFetch = async () => new Response(json, { status: 200 });
		const loaded = await loadSearchIndex('stonetop', fakeFetch);
		expect(search(loaded, 'danger').map((h) => h.id)).toContain('defy-danger');
	});

	it('memoises per game, and does not cache a failure', async () => {
		const json = JSON.stringify(buildIndex());
		let fetches = 0;
		const ok = async () => {
			fetches++;
			return new Response(json, { status: 200 });
		};
		// Reopening the mobile search panel must not re-parse a megabyte.
		const first = await loadSearchIndex('stonetop', ok);
		expect(await loadSearchIndex('stonetop', ok)).toBe(first);
		expect(fetches).toBe(1);
		// A different game is a different index.
		await loadSearchIndex('hmtw', ok);
		expect(fetches).toBe(2);

		clearSearchIndexCache();
		const boom = async () => new Response('nope', { status: 500 });
		await expect(loadSearchIndex('stonetop', boom)).rejects.toThrow(/failed to load index/);
		// The rejection is evicted, so a later attempt can still succeed.
		expect(search(await loadSearchIndex('stonetop', ok), 'danger')).not.toHaveLength(0);
	});
});

describe('GM index (reference gate)', () => {
	it('loadGmSearchIndex returns null when the game ships no GM index', async () => {
		const fakeFetch = async () => new Response('not found', { status: 404 });
		expect(await loadGmSearchIndex('stonetop', fakeFetch)).toBeNull();
	});

	const hit = (id: string, score: number, visibility: 'player' | 'gm' = 'player'): SearchHit => ({
		id,
		title: id,
		breadcrumb: id,
		docTitle: 'Book',
		visibility,
		body: '',
		score,
		terms: []
	});

	it('mergeHits orders player + gm hits by score and caps the count', () => {
		const player = [hit('p-hi', 9), hit('p-lo', 2)];
		const gm = [hit('gm-mid', 5, 'gm')];
		const merged = mergeHits(player, gm);
		expect(merged.map((h) => h.id)).toEqual(['p-hi', 'gm-mid', 'p-lo']);

		const many = Array.from({ length: 50 }, (_, i) => hit(`p${i}`, i));
		expect(mergeHits(many, [], 40)).toHaveLength(40);
	});
});
