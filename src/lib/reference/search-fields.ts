/**
 * Shared MiniSearch configuration and text prep for the rules search index.
 *
 * Imported by both the build script (`tools/build_search.ts`, which creates the
 * index) and the client (`search.ts`, which loads it) — the two MUST agree on
 * `fields`/`storeFields`, so they live here once. No framework imports, so the
 * node build tooling can pull it in directly.
 */

/** Fields tokenised and indexed for matching. */
export const SEARCH_FIELDS = ['title', 'breadcrumb', 'body'];
/** Fields kept on each result for display (index stores no `body`, to stay small). */
export const STORE_FIELDS = ['title', 'breadcrumb', 'docTitle', 'visibility', 'excerpt'];

/** Options passed identically to `new MiniSearch(...)` and `MiniSearch.loadJSON(...)`. */
export const miniSearchOptions = { fields: SEARCH_FIELDS, storeFields: STORE_FIELDS };

/** Max characters kept for a result's preview excerpt. */
export const EXCERPT_LENGTH = 240;

/** A section flattened into an indexable/searchable document. */
export interface SearchDoc {
	id: string;
	title: string;
	breadcrumb: string;
	docTitle: string;
	visibility: 'player' | 'gm';
	excerpt: string;
	/** Plain-text body — indexed, not stored. */
	body: string;
}

const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
const IMAGE_EMBED = /!\[\[[^\]]*\]\]/g;

/** Strip markdown/Obsidian syntax to plain text for indexing and excerpts. */
export function toPlainText(markdown: string): string {
	return markdown
		.replace(IMAGE_EMBED, '')
		.replace(WIKILINK, (_m, target, label) =>
			String(label ?? String(target).split('#').pop() ?? target).trim()
		)
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) -> text
		.replace(/[*_`>#|~]/g, ' ') // emphasis, code, quote, heading, table, strike markers
		.replace(/\s+/g, ' ')
		.trim();
}

/** Build a result excerpt: plain text, trimmed to `EXCERPT_LENGTH` with an ellipsis. */
export function excerptOf(plain: string): string {
	return plain.length > EXCERPT_LENGTH ? `${plain.slice(0, EXCERPT_LENGTH).trimEnd()}…` : plain;
}
