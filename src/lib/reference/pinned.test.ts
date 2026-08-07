/**
 * Curated pinned terms (phase 22): build-time resolution + player/GM split,
 * and the runtime merge/match the search page runs.
 */

import { describe, expect, it } from 'vitest';
import { documentTreeSchema, type DocumentTree } from './document-tree';
import { matchPinnedTerms, mergePinnedTerms, resolvePinnedTerms, type SourceTerm } from './pinned';

const trees: DocumentTree[] = [
	documentTreeSchema.parse({
		id: 'book',
		title: 'The Book',
		sections: [
			{ id: '06-crawl', title: 'The Crawl Phase', level: 1, path: [], body: '' },
			{
				id: '06-crawl--meatgrinder',
				title: 'Meatgrinder',
				level: 2,
				path: ['The Crawl Phase'],
				body: '^meatgrinder'
			},
			{
				id: '13-denizens',
				title: 'Dungeon Denizens',
				level: 1,
				path: [],
				body: '',
				visibility: 'gm'
			},
			{
				id: '13-denizens--undead',
				title: 'Undead',
				level: 2,
				path: ['Dungeon Denizens'],
				body: '',
				visibility: 'gm'
			}
		]
	})
];

describe('resolvePinnedTerms', () => {
	it('resolves internal targets and splits by section visibility', () => {
		const source: SourceTerm[] = [
			{
				term: 'Meatgrinder',
				targets: [
					{ file: '06 - Crawl', anchor: 'Meatgrinder', label: 'Meatgrinder' },
					{ file: '13 - Denizens', anchor: 'Undead', label: 'Undead horde' }
				]
			},
			{ term: 'Undead', targets: [{ file: '13 - Denizens', anchor: 'Undead', label: 'Undead' }] }
		];
		const { player, gm } = resolvePinnedTerms(source, trees);
		// Mixed term: player copy keeps only the player target…
		expect(player).toEqual([
			{
				term: 'Meatgrinder',
				targets: [{ label: 'Meatgrinder', id: '06-crawl--meatgrinder', visibility: 'player' }]
			}
		]);
		// …the GM copy carries the stripped target, and the all-GM term goes GM-only
		// (its label alone would be the spoiler in the player file).
		expect(gm.map((t) => t.term)).toEqual(['Meatgrinder', 'Undead']);
		expect(gm[1].targets[0]).toEqual({
			label: 'Undead',
			id: '13-denizens--undead',
			visibility: 'gm'
		});
	});

	it('resolves an empty anchor to the note itself and block-id anchors', () => {
		const source: SourceTerm[] = [
			{
				term: 'Crawl',
				targets: [
					{ file: '06 - Crawl', anchor: '', label: 'The Crawl Phase' },
					{ file: '06 - Crawl', anchor: '^meatgrinder', label: 'By block id' }
				]
			}
		];
		const { player } = resolvePinnedTerms(source, trees);
		expect(player[0].targets.map((t) => t.id)).toEqual(['06-crawl', '06-crawl--meatgrinder']);
	});

	it('passes external targets through, defaulting the label to the term', () => {
		const source: SourceTerm[] = [
			{
				term: 'Tomb of Golden Ghosts',
				targets: [{ url: 'https://dungeons.example.com', note: 'Official course' }]
			}
		];
		const { player, gm } = resolvePinnedTerms(source, trees);
		expect(player[0].targets).toEqual([
			{
				label: 'Tomb of Golden Ghosts',
				url: 'https://dungeons.example.com',
				note: 'Official course',
				visibility: 'player'
			}
		]);
		expect(gm).toEqual([]);
	});

	it('throws on an unresolvable target, listing the term', () => {
		const source: SourceTerm[] = [
			{ term: 'Ghost', targets: [{ file: '06 - Crawl', anchor: 'No Such Heading', label: 'x' }] }
		];
		expect(() => resolvePinnedTerms(source, trees)).toThrowError(/Ghost.*No Such Heading/s);
	});
});

describe('mergePinnedTerms / matchPinnedTerms', () => {
	const player = [
		{ term: 'Meatgrinder', targets: [{ label: 'a', id: 'p1', visibility: 'player' as const }] }
	];
	const gm = [
		{ term: 'Meatgrinder', targets: [{ label: 'b', id: 'g1', visibility: 'gm' as const }] },
		{ term: 'Undead', targets: [{ label: 'c', id: 'g2', visibility: 'gm' as const }] }
	];

	it('merges same-name terms and appends GM-only ones', () => {
		const merged = mergePinnedTerms(player, gm);
		expect(merged.map((t) => t.term)).toEqual(['Meatgrinder', 'Undead']);
		expect(merged[0].targets.map((t) => t.id)).toEqual(['p1', 'g1']);
	});

	it('handles either side being absent', () => {
		expect(mergePinnedTerms(null, gm)).toEqual(gm);
		expect(mergePinnedTerms(player, null)).toEqual(player);
		expect(mergePinnedTerms(null, null)).toEqual([]);
	});

	it('ranks exact over prefix over substring, and pins nothing on empty query', () => {
		const terms = mergePinnedTerms(player, gm);
		expect(matchPinnedTerms(terms, 'undead').map((t) => t.term)).toEqual(['Undead']);
		expect(matchPinnedTerms(terms, 'meat').map((t) => t.term)).toEqual(['Meatgrinder']);
		expect(matchPinnedTerms(terms, 'dead').map((t) => t.term)).toEqual(['Undead']);
		expect(matchPinnedTerms(terms, '')).toEqual([]);
		expect(matchPinnedTerms(terms, 'zzz')).toEqual([]);
	});
});
