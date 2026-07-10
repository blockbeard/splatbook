import { describe, it, expect } from 'vitest';
import { queryTerms, highlight, makeSnippet } from './snippet';

describe('queryTerms', () => {
	it('folds, tokenizes, and dedupes', () => {
		expect(queryTerms('Defy  DANGER, defy!')).toEqual(['defy', 'danger']);
	});

	it('drops apostrophes', () => {
		expect(queryTerms('death’s door')).toEqual(['deaths', 'door']);
	});
});

describe('highlight', () => {
	it('wraps matched terms in <mark>', () => {
		expect(highlight('Defy Danger', ['danger'])).toBe('Defy <mark>Danger</mark>');
	});

	it('escapes HTML before marking', () => {
		expect(highlight('a < b & c', ['b'])).toBe('a &lt; <mark>b</mark> &amp; c');
	});

	it('matches across an apostrophe', () => {
		expect(highlight('deaths door', ['deaths'])).toContain('<mark>deaths</mark>');
		expect(highlight("death's door", ['deaths'])).toContain("<mark>death's</mark>");
	});
});

describe('makeSnippet', () => {
	const body =
		'Intro sentence here. When danger looms you roll. A following sentence. Yet another one. And a fifth.';

	it('centers the short snippet on the first matching sentence', () => {
		const { short } = makeSnippet(body, ['danger']);
		expect(short).toBe('When danger looms you roll.');
	});

	it('expands full to surrounding context', () => {
		const { full } = makeSnippet(body, ['danger']);
		expect(full).toContain('Intro sentence here.');
		expect(full).toContain('When danger looms you roll.');
		expect(full).toContain('A following sentence.');
		expect(full.length).toBeGreaterThan('When danger looms you roll.'.length);
	});

	it('falls back to the body opening when no term matches', () => {
		const { short } = makeSnippet('No relevant terms here at all.', ['xyzzy']);
		expect(short).toBe('No relevant terms here at all.');
	});
});
