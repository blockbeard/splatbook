/**
 * The tree-free wikilink pass (phase 21): index building and serialization
 * round-trips, target resolution, and the `[[…]]` → markdown-link rewrite
 * that move cards / steading lines run over pack text.
 */

import { describe, expect, it } from 'vitest';
import type { DocumentTree } from './document-tree';
import {
	buildLinkIndex,
	deserializeLinkIndex,
	resolveTarget,
	resolveWikilinks,
	serializeLinkIndex
} from './inline';

const tree: DocumentTree = {
	id: 'book-i',
	title: 'Book I',
	chapters: [],
	sections: [
		{
			id: 'player-moves--clash',
			title: 'Clash',
			level: 2,
			path: ['Player Moves'],
			body: 'Fight text\n^clash\n',
			pages: [],
			chapter: 'player-moves'
		},
		{
			id: 'homefront--seasons',
			title: 'Seasons',
			level: 2,
			path: ['Homefront'],
			body: '> [!move] quoted\n> ^seasons-change\n',
			pages: [],
			chapter: 'homefront'
		}
	]
} as unknown as DocumentTree;

const index = buildLinkIndex([tree]);
const href = (id: string): string => `/stonetop/reference/${id}`;

describe('buildLinkIndex / serialization', () => {
	it('indexes titles and block ids (quoted included)', () => {
		expect(index.byTitle.get('clash')).toEqual(['player-moves--clash']);
		expect(index.byBlockId.get('clash')).toEqual(['player-moves--clash']);
		expect(index.byBlockId.get('seasons-change')).toEqual(['homefront--seasons']);
	});

	it('round-trips through the serialized form', () => {
		const back = deserializeLinkIndex(serializeLinkIndex(index));
		expect(back.byTitle).toEqual(index.byTitle);
		expect(back.byBlockId).toEqual(index.byBlockId);
	});
});

describe('resolveTarget', () => {
	it('resolves a block-id target', () => {
		expect(resolveTarget(index, '06 - Player Moves#^clash')).toBe('player-moves--clash');
	});

	it('resolves a heading target', () => {
		expect(resolveTarget(index, 'Anything#Clash')).toBe('player-moves--clash');
	});

	it('returns null for an unknown target', () => {
		expect(resolveTarget(index, 'Nowhere#^missing')).toBeNull();
	});
});

describe('resolveWikilinks', () => {
	it('rewrites a resolvable link as a markdown link', () => {
		expect(resolveWikilinks('see [[06 - Player Moves#^clash|Clash]].', index, href)).toBe(
			'see [Clash](/stonetop/reference/player-moves--clash).'
		);
	});

	it('degrades an unresolvable link to its label — never raw [[…]]', () => {
		expect(resolveWikilinks('see [[Nowhere#^missing|Elsewhere]].', index, href)).toBe(
			'see Elsewhere.'
		);
	});

	it('uses the target tail as the label when none is given', () => {
		expect(resolveWikilinks('see [[Clash]]', index, href)).toBe(
			'see [Clash](/stonetop/reference/player-moves--clash)'
		);
	});

	it('renders labels plainly with no index at all', () => {
		expect(resolveWikilinks('see [[06 - Player Moves#^clash|Clash]].', null, href)).toBe(
			'see Clash.'
		);
	});

	it('drops image embeds and leaves other markdown alone', () => {
		expect(resolveWikilinks('![[art.png]]**bold** stays', index, href)).toBe('**bold** stays');
	});
});
