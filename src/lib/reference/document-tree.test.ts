import { describe, it, expect } from 'vitest';
import {
	documentTreeSchema,
	documentSectionSchema,
	buildSectionTree,
	findSection,
	type DocumentSection
} from './document-tree';

const section = (
	over: Partial<DocumentSection> & Pick<DocumentSection, 'id' | 'level'>
): DocumentSection => ({
	title: over.id,
	path: [],
	body: '',
	visibility: 'player',
	...over
});

describe('documentSectionSchema', () => {
	it('defaults visibility to player', () => {
		const parsed = documentSectionSchema.parse({
			id: 'defy-danger',
			title: 'Defy Danger',
			level: 3,
			path: ['Player Moves', 'Basic Moves'],
			body: 'When danger looms…'
		});
		expect(parsed.visibility).toBe('player');
	});

	it('accepts an explicit gm visibility and page anchors', () => {
		const parsed = documentSectionSchema.parse({
			id: 'the-forge',
			title: 'The Forge',
			level: 2,
			path: [],
			body: 'Secret lore.',
			pages: [212, 213],
			visibility: 'gm'
		});
		expect(parsed.visibility).toBe('gm');
		expect(parsed.pages).toEqual([212, 213]);
	});

	it('accepts an explicit kind from a callout heading', () => {
		const parsed = documentSectionSchema.parse({
			id: 'clash',
			title: 'CLASH',
			level: 2,
			path: ['Player Moves', 'Basic Moves'],
			body: 'When you fight in melee…',
			kind: 'move'
		});
		expect(parsed.kind).toBe('move');
	});

	it('leaves kind undefined for a plain heading', () => {
		const parsed = documentSectionSchema.parse({
			id: 'the-forge',
			title: 'The Forge',
			level: 2,
			path: [],
			body: 'Secret lore.'
		});
		expect(parsed.kind).toBeUndefined();
	});

	it('rejects an out-of-range heading level', () => {
		expect(() =>
			documentSectionSchema.parse({ id: 'x', title: 'X', level: 7, path: [], body: '' })
		).toThrow();
	});

	it('rejects unknown keys (strict)', () => {
		expect(() =>
			documentSectionSchema.parse({ id: 'x', title: 'X', level: 1, path: [], body: '', extra: 1 })
		).toThrow();
	});
});

describe('documentTreeSchema', () => {
	it('round-trips a small tree', () => {
		const input = {
			id: 'book-i',
			title: 'Book I: Stonetop',
			sections: [
				section({ id: 'moves', title: 'Player Moves', level: 1 }),
				section({ id: 'basic', title: 'Basic Moves', level: 2, path: ['Player Moves'] })
			]
		};
		const parsed = documentTreeSchema.parse(input);
		expect(parsed.sections).toHaveLength(2);
		expect(parsed.sections[1].visibility).toBe('player');
	});

	it('rejects duplicate section ids', () => {
		const dup = {
			id: 'book-i',
			title: 'Book I',
			sections: [section({ id: 'moves', level: 1 }), section({ id: 'moves', level: 2 })]
		};
		const result = documentTreeSchema.safeParse(dup);
		expect(result.success).toBe(false);
		expect(result.error?.issues[0].message).toMatch(/duplicate section id/);
	});
});

describe('buildSectionTree', () => {
	const flat: DocumentSection[] = [
		section({ id: 'a', level: 1, visibility: 'player' }),
		section({ id: 'a1', level: 2, visibility: 'player' }),
		section({ id: 'a1x', level: 3, visibility: 'player' }),
		section({ id: 'a2', level: 2, visibility: 'player' }),
		section({ id: 'b', level: 1, visibility: 'player' })
	];

	it('nests by heading level', () => {
		const roots = buildSectionTree(flat);
		expect(roots.map((n) => n.section.id)).toEqual(['a', 'b']);
		expect(roots[0].children.map((n) => n.section.id)).toEqual(['a1', 'a2']);
		expect(roots[0].children[0].children.map((n) => n.section.id)).toEqual(['a1x']);
	});

	it('promotes a section with no lower-level ancestor to a root', () => {
		const roots = buildSectionTree([
			section({ id: 'deep', level: 3, visibility: 'player' }),
			section({ id: 'top', level: 1, visibility: 'player' })
		]);
		expect(roots.map((n) => n.section.id)).toEqual(['deep', 'top']);
	});
});

describe('findSection', () => {
	it('finds by id', () => {
		const tree = documentTreeSchema.parse({
			id: 't',
			title: 'T',
			sections: [section({ id: 'here', level: 1 })]
		});
		expect(findSection(tree, 'here')?.title).toBe('here');
		expect(findSection(tree, 'nope')).toBeUndefined();
	});
});
