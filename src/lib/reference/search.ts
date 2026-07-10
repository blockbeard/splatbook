/**
 * Client-side rules search: load the prebuilt MiniSearch index and query it.
 *
 * The index is generated at build time (`tools/build_search.ts`) and served
 * statically, so search runs entirely in the browser — no server round-trips,
 * and it keeps working offline once the index is cached.
 */

import MiniSearch, { type SearchResult } from 'minisearch';
import { base } from '$app/paths';
import { miniSearchOptions } from './search-fields';

/** The subset of `fetch` a SvelteKit `load` (or the browser) provides. */
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** A search result with the stored display fields flattened on. */
export interface SearchHit {
	id: string;
	title: string;
	breadcrumb: string;
	docTitle: string;
	visibility: 'player' | 'gm';
	excerpt: string;
	score: number;
	/** Matched query terms, for highlighting. */
	terms: string[];
}

/** Fetch and deserialize a game's search index. */
export async function loadSearchIndex(gameId: string, fetchFn: Fetcher): Promise<MiniSearch> {
	const res = await fetchFn(`${base}/content-packs/${gameId}/search-index.json`);
	if (!res.ok) throw new Error(`search: failed to load index for "${gameId}" (${res.status})`);
	return MiniSearch.loadJSON(await res.text(), miniSearchOptions);
}

/** Run a query. Empty query returns nothing; prefix + light fuzz for a live-search feel. */
export function search(index: MiniSearch, query: string, limit = 40): SearchHit[] {
	const q = query.trim();
	if (!q) return [];
	const results = index.search(q, {
		prefix: true,
		fuzzy: 0.2,
		boost: { title: 3, breadcrumb: 1.5 },
		combineWith: 'AND'
	});
	return results.slice(0, limit).map((r: SearchResult) => ({
		id: r.id as string,
		title: r.title,
		breadcrumb: r.breadcrumb,
		docTitle: r.docTitle,
		visibility: r.visibility,
		excerpt: r.excerpt,
		score: r.score,
		terms: r.terms
	}));
}
