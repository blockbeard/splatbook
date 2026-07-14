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
/** A line that is only a named block id (Obsidian's link anchor, e.g. `^clash`
 * bare or `> ^clash` inside a callout) — never prose. Mirrors `render.ts`'s
 * `BLOCK_ID_LINE`; kept a separate constant since the two files deliberately
 * don't share a module (see the file doc above). `[ \t]`, not `\s`, around
 * the marker — `\s` matches a newline too, and with the `m` flag a greedy
 * `\s*` anchored at start-of-line will eat the line break looking for more
 * "whitespace" and merge into the next line, losing a paragraph break. */
const BLOCK_ID_LINE = /^>?[ \t]*\^[\w-]+[ \t]*$/gm;
/** A callout's opening marker, `[!type]` (optionally folded `+`/`-`) — the
 * type becomes styling in the reference page (`render.ts`); here it's just
 * noise to drop so search snippets don't show it verbatim. */
const CALLOUT_MARKER = /\[!\w+\][+-]?/g;

/** Strip markdown/Obsidian syntax to plain text for indexing and excerpts. */
export function toPlainText(markdown: string): string {
	return markdown
		.replace(IMAGE_EMBED, '')
		.replace(BLOCK_ID_LINE, '')
		.replace(CALLOUT_MARKER, '')
		.replace(WIKILINK, (_m, target, label) =>
			String(label ?? String(target).split('#').pop() ?? target).trim()
		)
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) -> text
		.replace(/[*_`>#|~]/g, ' ') // emphasis, code, quote, heading, table, strike markers
		.replace(/\s+/g, ' ')
		.trim();
}
