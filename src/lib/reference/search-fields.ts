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
/** Fields kept on each result. `body` is stored (plain text) so match-centered
 * snippets and their in-place expansion work client-side and offline. */
export const STORE_FIELDS = ['title', 'breadcrumb', 'docTitle', 'visibility', 'body'];

/** Options passed identically to `new MiniSearch(...)` and `MiniSearch.loadJSON(...)`. */
export const miniSearchOptions = { fields: SEARCH_FIELDS, storeFields: STORE_FIELDS };

/** A section flattened into an indexable/searchable document. */
export interface SearchDoc {
	id: string;
	title: string;
	breadcrumb: string;
	docTitle: string;
	visibility: 'player' | 'gm';
	/** Plain-text body — indexed and stored (drives snippets). */
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
