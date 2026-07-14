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
	/** Plain-text body, for match-centered snippets. */
	body: string;
	score: number;
	/** Matched query terms, for highlighting. */
	terms: string[];
}

/** Fetch and deserialize a game's (player) search index. */
export async function loadSearchIndex(gameId: string, fetchFn: Fetcher): Promise<MiniSearch> {
	const res = await fetchFn(`${base}/content-packs/${gameId}/search-index.json`);
	if (!res.ok) throw new Error(`search: failed to load index for "${gameId}" (${res.status})`);
	return MiniSearch.loadJSON(await res.text(), miniSearchOptions);
}

/**
 * Fetch the GM-only search index (Book II). Loaded only when the reader has
 * opted into spoilers (`showSetting`, commit 97); returns `null` if the game
 * ships no GM index (a 404), so a game without GM content search just falls
 * back to the player one.
 */
export async function loadGmSearchIndex(
	gameId: string,
	fetchFn: Fetcher
): Promise<MiniSearch | null> {
	const res = await fetchFn(`${base}/content-packs/${gameId}/search-index-gm.json`);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`search: failed to load GM index for "${gameId}" (${res.status})`);
	return MiniSearch.loadJSON(await res.text(), miniSearchOptions);
}

/**
 * Merge hits from the player and (optional) GM indexes into one score-ordered
 * list, capped at `limit`. Ids are unique across the two indexes, so no dedupe
 * is needed — GM sections live only in the GM index.
 */
export function mergeHits(player: SearchHit[], gm: SearchHit[], limit = 40): SearchHit[] {
	return [...player, ...gm].sort((a, b) => b.score - a.score).slice(0, limit);
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
		body: r.body,
		score: r.score,
		terms: r.terms
	}));
}
