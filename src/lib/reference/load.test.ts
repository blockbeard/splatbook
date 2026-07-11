import { describe, it, expect } from 'vitest';
import { documentTreeSchema, type DocumentTree } from './document-tree';
import { tocOf, findSection, ancestorsOf, childrenOf, siblingsInOrder, isVisible } from './load';

const tree: DocumentTree = documentTreeSchema.parse({
	id: 'book-i',
	title: 'Book I',
	sections: [
		{ id: 'a', title: 'A', level: 1, path: [], body: 'a body' },
		{ id: 'a1', title: 'A1', level: 2, path: ['A'], body: 'a1 body' },
		{ id: 'a1x', title: 'A1x', level: 3, path: ['A', 'A1'], body: 'a1x body' },
		{ id: 'a2', title: 'A2', level: 2, path: ['A'], body: 'a2 body' },
		{ id: 'b', title: 'B', level: 1, path: [], body: 'b body' }
	]
});

const second: DocumentTree = documentTreeSchema.parse({
	id: 'book-ii',
	title: 'Book II',
	sections: [{ id: 'z', title: 'Z', level: 1, path: [], body: 'z' }]
});

describe('tocOf', () => {
	it('strips bodies and keeps navigation fields', () => {
		const [doc] = tocOf([tree]);
		expect(doc.id).toBe('book-i');
		expect(doc.sections).toHaveLength(5);
		expect(doc.sections[0]).toEqual({
			id: 'a',
			title: 'A',
			level: 1,
			path: [],
			visibility: 'player'
		});
		expect('body' in doc.sections[0]).toBe(false);
	});

	it('applies an include filter', () => {
		const [doc] = tocOf([tree], (s) => s.level === 1);
		expect(doc.sections.map((s) => s.id)).toEqual(['a', 'b']);
	});
});

describe('findSection', () => {
	it('finds across trees', () => {
		expect(findSection([tree, second], 'a1x')?.index).toBe(2);
		expect(findSection([tree, second], 'z')?.tree.id).toBe('book-ii');
		expect(findSection([tree, second], 'missing')).toBeUndefined();
	});
});

describe('ancestorsOf', () => {
	it('returns the root→parent chain', () => {
		expect(ancestorsOf(tree, 2).map((s) => s.id)).toEqual(['a', 'a1']);
		expect(ancestorsOf(tree, 3).map((s) => s.id)).toEqual(['a']);
		expect(ancestorsOf(tree, 0)).toEqual([]);
	});
});

describe('childrenOf', () => {
	it('returns immediate children only', () => {
		expect(childrenOf(tree, 0).map((s) => s.id)).toEqual(['a1', 'a2']);
		expect(childrenOf(tree, 1).map((s) => s.id)).toEqual(['a1x']);
		expect(childrenOf(tree, 4)).toEqual([]);
	});
});

describe('siblingsInOrder', () => {
	it('gives document-order prev/next', () => {
		expect(siblingsInOrder(tree, 0)).toEqual({ prev: null, next: { id: 'a1', title: 'A1' } });
		expect(siblingsInOrder(tree, 4).next).toBeNull();
		expect(siblingsInOrder(tree, 2).prev).toEqual({ id: 'a1', title: 'A1' });
	});
});

describe('visibility gate', () => {
	const gmTree: DocumentTree = documentTreeSchema.parse({
		id: 'book-ii',
		title: 'Book II',
		sections: [{ id: 'lore', title: 'Lore', level: 1, path: [], body: 'secret', visibility: 'gm' }]
	});

	it('hides gm content by default (gate closed) and shows it when open', () => {
		// Fails closed: no flag means player-only.
		expect(isVisible({ visibility: 'player' })).toBe(true);
		expect(isVisible({ visibility: 'gm' })).toBe(false);
		// Gate open (viewer is a campaign GM): gm content becomes visible.
		expect(isVisible({ visibility: 'gm' }, true)).toBe(true);
		expect(isVisible({ visibility: 'player' }, true)).toBe(true);
	});

	it('tocOf drops gm sections for players but keeps them for GMs', () => {
		const [closed] = tocOf([gmTree], (s) => isVisible(s));
		expect(closed.sections).toHaveLength(0);
		const [open] = tocOf([gmTree], (s) => isVisible(s, true));
		expect(open.sections).toHaveLength(1);
		const [playerDoc] = tocOf([tree], (s) => isVisible(s));
		expect(playerDoc.sections).toHaveLength(5);
	});
});
