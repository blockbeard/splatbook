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

	it('resolves a note-only link to the note’s opening section', () => {
		// A chapter’s opening section id is the slug of its source stem —
		// exactly what a bare [[Note|label]] link names.
		expect(resolveTarget(index, '06 - Player Moves')).toBeNull(); // no such opener here
		expect(resolveTarget(chapterIndex, '15 - Appendix E - Underworld Creation')).toBe(
			'15-appendix-e-underworld-creation'
		);
	});
});

// A multi-H1-style tree (HMtW shape): a chapter opener whose id is the file
// slug, duplicate section titles, and a body carrying a nested-anchor link.
const chapterTree: DocumentTree = {
	id: 'book',
	title: 'The Book',
	chapters: [{ id: '15-appendix-e-underworld-creation', title: 'Appendix E' }],
	sections: [
		{
			id: '15-appendix-e-underworld-creation',
			title: 'Appendix E: Underworld Creation',
			level: 1,
			path: [],
			body: 'see [[07 - The Challenge Phase#GMing the Challenge#1. Draw Challenge cards|deep]]',
			chapter: '15-appendix-e-underworld-creation'
		},
		{
			id: '07-the-challenge-phase',
			title: 'The Challenge Phase',
			level: 1,
			path: [],
			body: '',
			chapter: '07-the-challenge-phase'
		},
		{
			id: '07-the-challenge-phase--1-draw-challenge-cards',
			title: '1. Draw Challenge cards',
			level: 3,
			path: ['The Challenge Phase', 'The Procedure'],
			body: 'player-side',
			chapter: '07-the-challenge-phase'
		},
		{
			id: '07-the-challenge-phase--gming-the-challenge',
			title: 'GMing the Challenge',
			level: 2,
			path: ['The Challenge Phase'],
			body: '',
			chapter: '07-the-challenge-phase'
		},
		{
			id: '07-the-challenge-phase--1-draw-challenge-cards-2',
			title: '1. Draw Challenge cards',
			level: 3,
			path: ['The Challenge Phase', 'GMing the Challenge'],
			body: 'gm-side',
			chapter: '07-the-challenge-phase'
		}
	]
} as unknown as DocumentTree;
const chapterIndex = buildLinkIndex([chapterTree]);

describe('nested anchors', () => {
	it('indexes a body’s nested-anchor link as a composite key, scoped in document order', () => {
		// Both parts share a title with an earlier section — the composite key
		// must land on the occurrence *after* the parent, not the first.
		expect(
			resolveTarget(chapterIndex, '07 - The Challenge Phase#GMing the Challenge#1. Draw Challenge cards')
		).toBe('07-the-challenge-phase--1-draw-challenge-cards-2');
	});

	it('keeps the composite key through serialization for tree-free consumers', () => {
		const back = deserializeLinkIndex(serializeLinkIndex(chapterIndex));
		expect(
			resolveTarget(back, '07 - The Challenge Phase#GMing the Challenge#1. Draw Challenge cards')
		).toBe('07-the-challenge-phase--1-draw-challenge-cards-2');
	});

	it('adds no composite keys when no nested links exist', () => {
		for (const key of index.byTitle.keys()) expect(key).not.toContain('#');
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

	it('rewrites an external { url } target as an outbound markdown link', () => {
		// Phase 22: a curated term can point outside the app (e.g. HMtW's Tomb
		// of Golden Ghosts → the official Designing Dungeons course).
		const external = deserializeLinkIndex({
			byTitle: {
				'tomb of golden ghosts': [{ url: 'https://dungeons.hismajestytheworm.games' }]
			},
			byBlockId: {}
		});
		expect(resolveWikilinks('see [[Tomb of Golden Ghosts|the Tomb]]', external, href)).toBe(
			'see [the Tomb](https://dungeons.hismajestytheworm.games)'
		);
	});
});
