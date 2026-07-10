import { describe, it, expect } from 'vitest';
import { documentTreeSchema, type DocumentTree } from './document-tree';
import { buildLinkIndex, renderMarkdown } from './render';

const trees: DocumentTree[] = [
	documentTreeSchema.parse({
		id: 'book-i',
		title: 'Book I',
		sections: [
			{ id: '06-player-moves', title: 'Player Moves', level: 1, path: [], body: '' },
			{
				id: '06-player-moves--defy-danger',
				title: 'DEFY DANGER',
				level: 3,
				path: ['Player Moves'],
				body: ''
			},
			{ id: 'the-fox', title: 'The Fox', level: 1, path: [], body: '' }
		]
	})
];

const index = buildLinkIndex(trees);

describe('renderMarkdown', () => {
	it('resolves a wikilink to a reference deep-link', () => {
		const html = renderMarkdown(
			'See [[06 - Player Moves#DEFY DANGER|Defy Danger]].',
			'stonetop',
			index
		);
		expect(html).toContain('href="/g/stonetop/reference/06-player-moves--defy-danger"');
		expect(html).toContain('>Defy Danger</a>');
		expect(html).not.toContain('[[');
	});

	it('resolves a note-only wikilink to that note’s opening section', () => {
		const html = renderMarkdown('[[The Fox]]', 'stonetop', index);
		expect(html).toContain('href="/g/stonetop/reference/the-fox"');
	});

	it('falls back to the label when the target is unknown', () => {
		const html = renderMarkdown('[[Nowhere#Nope|just text]] here', 'stonetop', index);
		expect(html).toContain('just text');
		expect(html).not.toContain('href');
		expect(html).not.toContain('[[');
	});

	it('renders ordinary markdown', () => {
		const html = renderMarkdown('**bold** and *italic*', 'stonetop', index);
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<em>italic</em>');
	});

	it('drops stray image embeds', () => {
		const html = renderMarkdown('text ![[map.png]] more', 'stonetop', index);
		expect(html).not.toContain('map.png');
		expect(html).toContain('text');
	});
});
