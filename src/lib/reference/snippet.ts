/**
 * Match-centered snippets and term highlighting for search results.
 *
 * Ported from Chris's Obsidian rules-search tool (the reference UX the plan asks
 * this phase to lift): a result shows the first sentence that mentions a query
 * term (`short`); a "more" control expands it in place to a few surrounding
 * sentences (`full`); the result title still links to the full section. Terms
 * are highlighted with `<mark>`, apostrophe-flexible, on HTML-escaped text.
 */

const fold = (s: string): string => (s || '').toLowerCase().replace(/['’‘]/g, '');
const escHtml = (s: string): string =>
	s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Distinct, folded query tokens (letters/numbers), for matching and highlighting. */
export function queryTerms(query: string): string[] {
	return [...new Set(fold(query).match(/[\p{L}\p{N}]+/gu) ?? [])];
}

/** Escape `text`, then wrap occurrences of each term in `<mark>` (longest first). */
export function highlight(text: string, terms: string[]): string {
	let html = escHtml(text);
	for (const term of [...terms].sort((a, b) => b.length - a.length)) {
		if (!term) continue;
		const pattern = term.split('').map(escRe).join("['’‘]?");
		html = html.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
	}
	return html;
}

export interface Snippet {
	/** The first sentence containing a term (or the body's opening if none match). */
	short: string;
	/** A few sentences of surrounding context, for the in-place "more" expansion. */
	full: string;
}

/** Build the short/full snippet pair for a body against the query terms. */
export function makeSnippet(body: string, terms: string[]): Snippet {
	const sentences = body.split(/(?<=[.!?])\s+/);
	const idx = sentences.findIndex((s) => {
		const folded = fold(s);
		return terms.some((t) => folded.includes(t));
	});
	if (idx < 0) return { short: body.slice(0, 180), full: body.slice(0, 500) };
	const short = sentences[idx];
	const full = sentences.slice(Math.max(0, idx - 1), Math.min(sentences.length, idx + 3)).join(' ');
	return { short, full };
}
