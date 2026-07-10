import { describe, it, expect } from 'vitest';
import MiniSearch from 'minisearch';
import { toPlainText, miniSearchOptions, type SearchDoc } from './search-fields';
import { loadSearchIndex, search } from './search';

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
});
