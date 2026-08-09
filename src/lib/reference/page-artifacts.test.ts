import { describe, it, expect } from 'vitest';
import { documentTreeSchema, type DocumentTree } from './document-tree';
import {
	assertPackInvariants,
	buildDeepLinks,
	buildNav,
	buildPages,
	type ReferencePage
} from './page-artifacts';

const tree: DocumentTree = documentTreeSchema.parse({
	id: 'book-i',
	title: 'Book I',
	chapters: [
		{ id: 'ch1', title: 'One' },
		{ id: 'ch2', title: 'Two' }
	],
	sections: [
		{ id: 'ch1', title: 'A', level: 1, path: [], body: 'a body', chapter: 'ch1' },
		{ id: 'ch1--a1', title: 'A1', level: 2, path: ['A'], body: 'a1 body', chapter: 'ch1' },
		{ id: 'ch1--a1x', title: 'A1x', level: 3, path: ['A', 'A1'], body: 'a1x body', chapter: 'ch1' },
		{ id: 'ch1--a1x-deep', title: 'Deep', level: 4, path: [], body: 'deep body', chapter: 'ch1' },
		{ id: 'ch2', title: 'B', level: 1, path: [], body: 'b body', chapter: 'ch2' }
	]
});

const gmTree: DocumentTree = documentTreeSchema.parse({
	id: 'book-ii',
	title: 'Book II',
	chapters: [{ id: 'lore', title: 'Lore' }],
	sections: [
		{
			id: 'lore',
			title: 'Lore',
			level: 1,
			path: [],
			body: 'secret',
			visibility: 'gm',
			chapter: 'lore'
		}
	]
});

const byId = (pages: ReferencePage[], id: string) => pages.find((p) => p.id === id)!;

describe('buildNav', () => {
	it('drops bodies and caps depth at the level the sidebar renders', () => {
		const [doc] = buildNav([tree], { maxLevel: 3, gmVisible: false });
		expect(doc.sections.map((s) => s.id)).toEqual(['ch1', 'ch1--a1', 'ch1--a1x', 'ch2']);
		expect(doc.sections[0]).not.toHaveProperty('body');
		// `path` is carried by the trees and read by nothing — it must not ride along.
		expect(doc.sections[0]).not.toHaveProperty('path');
	});

	it('excludes gated chapters entirely for an opted-out reader', () => {
		// Not merely their sections: a gated chapter must not list by name in the
		// sidebar or on the chapter-card landing.
		const closed = buildNav([tree, gmTree], { maxLevel: 3, gmVisible: false });
		expect(closed.map((d) => d.id)).toEqual(['book-i']);
		const open = buildNav([tree, gmTree], { maxLevel: 3, gmVisible: true });
		expect(open.map((d) => d.id)).toEqual(['book-i', 'book-ii']);
		expect(open[1].chapters).toHaveLength(1);
	});
});

describe('buildPages', () => {
	it('gives every section its own page when the game caps nothing', () => {
		const pages = buildPages(tree, Infinity);
		expect(pages.map((p) => p.id)).toEqual(['ch1', 'ch1--a1', 'ch1--a1x', 'ch1--a1x-deep', 'ch2']);
		expect(pages.every((p) => p.inline.length === 0)).toBe(true);
	});

	it('folds sections below the page depth into their host page, in order', () => {
		const pages = buildPages(tree, 3);
		expect(pages.map((p) => p.id)).toEqual(['ch1', 'ch1--a1', 'ch1--a1x', 'ch2']);
		expect(byId(pages, 'ch1--a1x').inline.map((s) => s.id)).toEqual(['ch1--a1x-deep']);
		expect(byId(pages, 'ch1--a1x').inline[0].body).toBe('deep body');
	});

	it('carries the breadcrumb, the child tree, and the hosting page of each child', () => {
		const page = byId(buildPages(tree, 3), 'ch1--a1');
		expect(page.ancestors.map((a) => a.id)).toEqual(['ch1']);
		expect(page.chapterId).toBe('ch1');
		expect(page.docTitle).toBe('Book I');
		expect(page.children.map((c) => c.id)).toEqual(['ch1--a1x']);
		// The h4 has no page of its own, so it is listed against its host's id —
		// that is what makes its entry an in-page anchor rather than a dead link.
		expect(page.children[0].children[0]).toMatchObject({
			id: 'ch1--a1x-deep',
			pageId: 'ch1--a1x'
		});
	});

	it('walks prev/next over pages, skipping the sections that have none', () => {
		const pages = buildPages(tree, 3);
		expect(byId(pages, 'ch1').prev).toBeNull();
		expect(byId(pages, 'ch1').next).toEqual({ id: 'ch1--a1', title: 'A1' });
		expect(byId(pages, 'ch1--a1x').next).toEqual({ id: 'ch2', title: 'B' });
		expect(byId(pages, 'ch2').next).toBeNull();
	});

	it('keeps gated neighbours in the sequence rather than filtering them out', () => {
		// Deliberate, and the behaviour this replaced: a gated next/prev answers
		// with the spoiler interstitial, so opting in stays one click from
		// wherever the reader got stuck. Filtering it would strand them.
		const merged = documentTreeSchema.parse({
			id: 'book-i',
			title: 'Book I',
			sections: [
				{ id: 'open', title: 'Open', level: 1, path: [], body: '' },
				{ id: 'gated', title: 'Gated', level: 1, path: [], body: '', visibility: 'gm' }
			]
		});
		const pages = buildPages(merged, Infinity);
		expect(byId(pages, 'open').next).toEqual({ id: 'gated', title: 'Gated' });
		expect(byId(pages, 'gated').visibility).toBe('gm');
	});
});

describe('buildDeepLinks', () => {
	it('maps each below-depth section to the page that hosts it', () => {
		expect(buildDeepLinks(tree, 3)).toEqual({ 'ch1--a1x-deep': 'ch1--a1x' });
	});

	it('is empty when every heading is its own page', () => {
		expect(buildDeepLinks(tree, Infinity)).toEqual({});
	});
});

describe('assertPackInvariants', () => {
	it('accepts the shape the packs actually have', () => {
		expect(() => assertPackInvariants([tree, gmTree])).not.toThrow();
	});

	it('rejects an id reused across documents, which would overwrite a page file', () => {
		const clash = documentTreeSchema.parse({
			id: 'book-ii',
			title: 'Book II',
			sections: [{ id: 'ch1', title: 'Clash', level: 1, path: [], body: '' }]
		});
		expect(() => assertPackInvariants([tree, clash])).toThrow(/unique across a pack/);
	});

	it('rejects an id that would not be a safe file name', () => {
		const nasty = documentTreeSchema.parse({
			id: 'book-i',
			title: 'Book I',
			sections: [{ id: '../escape', title: 'Escape', level: 1, path: [], body: '' }]
		});
		expect(() => assertPackInvariants([nasty])).toThrow(/safe file name/);
	});
});
