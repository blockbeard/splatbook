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
				body: '> When *danger looms*, roll +STR.\n> ^defy-danger'
			},
			{ id: 'the-fox', title: 'The Fox', level: 1, path: [], body: '' },
			{
				id: '06-player-moves--clash',
				title: 'CLASH',
				level: 2,
				path: ['Player Moves'],
				body: '> Roll +STR.\n> ^clash',
				kind: 'move'
			}
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

	it('resolves a named-block-id wikilink, scoped to its note', () => {
		const html = renderMarkdown('See [[06 - Player Moves#^clash|Clash]].', 'stonetop', index);
		expect(html).toContain('href="/g/stonetop/reference/06-player-moves--clash"');
		expect(html).toContain('>Clash</a>');
	});

	it('boxes a heading-opened callout body as a styled aside, kind-labelled', () => {
		const section = index.byBlockId.get('clash');
		expect(section).toBeDefined();
		const html = renderMarkdown('> Roll +STR.\n> ^clash', 'stonetop', index, 'move');
		expect(html).toContain('<aside class="sb-callout sb-callout-move">');
		expect(html).toContain('sb-callout-label">Move</p>');
		expect(html).toContain('Roll +STR.');
		expect(html).not.toContain('^clash');
		expect(html).not.toContain('&gt;'); // no leftover blockquote marker
	});

	it('boxes an embedded (non-heading) callout, leaving surrounding prose alone', () => {
		const html = renderMarkdown(
			'Before.\n\n> [!box] **A title**\n> Boxed text.\n\nAfter.',
			'stonetop',
			index
		);
		expect(html).toContain('<aside class="sb-callout sb-callout-box">');
		expect(html).toContain('sb-callout-label">Box</p>');
		expect(html).toContain('Boxed text.');
		expect(html).toContain('<p>Before.</p>');
		expect(html).toContain('<p>After.</p>');
	});

	it('strips a bare block-id line even with no callout kind', () => {
		const html = renderMarkdown('Some text.\n^some-anchor\n\nMore text.', 'stonetop', index);
		expect(html).not.toContain('some-anchor');
		expect(html).toContain('Some text.');
		expect(html).toContain('More text.');
	});

	it('keeps a callout body’s own paragraph breaks (blank `>` separator lines)', () => {
		// Regression: `\s?`/`\s*` around the `>` marker matches a newline too, so
		// a naive de-quote merges "text\n>\n>more" into one paragraph instead of
		// two. Caught rendering the real end-of-session move (commit 91).
		const html = renderMarkdown(
			'> First paragraph.\n>\n> Second paragraph.\n>\n> - a bullet\n> - another\n> ^move-id',
			'stonetop',
			index,
			'move'
		);
		expect(html).toContain('<p>First paragraph.</p>');
		expect(html).toContain('<p>Second paragraph.</p>');
		expect(html).toContain('<li>a bullet</li>');
		expect(html).not.toContain('First paragraph.\nSecond paragraph.');
	});

	it('does not let one callout swallow a sibling right after it (no blank line between)', () => {
		// Regression: 09 - Threats strings several `[!box]` callouts back to
		// back with only a quoted blank line between them, no unquoted break.
		// A greedy ">"-line continuation swallowed every sibling into the
		// first, de-quoting their own [!type] openers into literal text.
		const html = renderMarkdown(
			'> [!box] First\n>\n> One text.\n> ^first\n>\n> [!box] Second\n>\n> Two text.\n> ^second',
			'stonetop',
			index
		);
		const asideCount = (html.match(/<aside class="sb-callout/g) ?? []).length;
		expect(asideCount).toBe(2);
		expect(html).toContain('One text.');
		expect(html).toContain('Two text.');
		expect(html).not.toContain('[!');
	});

	it('does not let a kind-tagged section’s leading run swallow a sibling callout after it', () => {
		// Regression: 08 - First Adventure's "Love letters" section is a
		// [!box]-opened heading whose body is followed by an embedded
		// [!Love Letter] example, separated only by a blank line — the same
		// blank-line-doesn't-end-the-run ambiguity as the previous case, but
		// at the leadingQuotedRun()/kind boundary instead of inside marked.
		const html = renderMarkdown(
			'> Guidance text.\n> ^love-letters\n\n> [!Love Letter]\n>\n> Dear reader…',
			'stonetop',
			index,
			'box'
		);
		const asideCount = (html.match(/<aside class="sb-callout/g) ?? []).length;
		expect(asideCount).toBe(2);
		expect(html).toContain('sb-callout-label">Box</p>');
		expect(html).toContain('sb-callout-label">Love Letter</p>');
		expect(html).not.toContain('[!');
	});

	it('normalizes a multi-word or hyphenated callout type to a CSS-safe kebab class', () => {
		const html = renderMarkdown('> [!minor arcanum] A card.', 'stonetop', index);
		expect(html).toContain('<aside class="sb-callout sb-callout-minor-arcanum">');
		expect(html).toContain('sb-callout-label">Minor Arcanum</p>');
	});

	it('falls through to a plain blockquote, without leaking synthetic markup, when a kind-tagged body has no real leading quoted content', () => {
		// Regression: some converted callouts (e.g. 03 - Playing the Game's
		// DEFEND) drop the ">" mid-paragraph and never pick it back up before
		// the real text — the leading run is just a blank line and the block
		// id. Boxing nothing is fine; leaking the section's own kind as
		// literal "[!move]" text is not.
		const html = renderMarkdown(
			'>\n> ^defend\nReal move text, unquoted.',
			'stonetop',
			index,
			'move'
		);
		expect(html).not.toContain('[!move]');
		expect(html).not.toContain('sb-callout');
		expect(html).toContain('Real move text, unquoted.');
	});
});
