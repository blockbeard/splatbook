/**
 * Fetching helpers for the rules reference.
 *
 * Everything is fetched from the served content pack
 * (`/content-packs/<game>/…`), already validated at build/CI, so the runtime
 * trusts it and skips re-parsing through Zod — the reference stays lean and
 * works client-side (and offline once cached).
 *
 * What is fetched is the point of phase 26: a nav spine and one page, never a
 * book. These loads are *universal*, so anything asked for here is paid twice
 * — once by the Worker (SvelteKit inlines a server-side fetch into the HTML so
 * hydration can replay it) and once by every browser that hydrates. Whole-book
 * trees made that 1.43 MB per section page; see `page-artifacts.ts`.
 */

import { base } from '$app/paths';
import { deserializeLinkIndex, type LinkIndex, type SerializedLinkIndex } from './inline';
import type { DocumentSection } from './document-tree';
import type { NavDocument, ReferencePage, ReferenceRedirect } from './page-artifacts';

/** The subset of `fetch` a SvelteKit `load` provides. */
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Section-visibility predicate for the current viewer. A `visibility: 'gm'`
 * section is hidden unless `gmVisible` is true. What decides that is up to
 * whoever calls this — for Stonetop's Book II it's a reader's own opt-in
 * preference (phase 13, `showSetting`), not campaign-GM membership; the flag
 * stays named generically because another game might use `visibility: 'gm'`
 * for content that genuinely is GM-only. Defaults to hidden, so any caller
 * that forgets to pass the flag fails closed.
 */
export function isVisible(
	section: Pick<DocumentSection, 'visibility'>,
	gmVisible = false
): boolean {
	return section.visibility !== 'gm' || gmVisible;
}

async function getJson<T>(fetchFn: Fetcher, url: string): Promise<T> {
	const res = await fetchFn(url);
	if (!res.ok) throw new Error(`reference: failed to load ${url} (${res.status})`);
	return (await res.json()) as T;
}

const navCache = new Map<string, Promise<NavDocument[]>>();

/** Drop the memoised nav spines. Test-only — the cache is module state. */
export function clearNavCache(): void {
	navCache.clear();
}

/**
 * Fetch a game's nav spine — the sidebar's chapters and their h2/h3s, already
 * filtered at build time to what this reader may see.
 *
 * Two artifacts rather than one filtered here, matching the split that
 * `search-index.json`/`search-index-gm.json` already uses: an opted-out reader
 * of Stonetop would otherwise download Book II's entire contents (259 KB vs
 * 80 KB) to have it filtered away.
 *
 * Memoised per game and variant. Unlike the whole-book trees this replaces,
 * memoisation is now an optimisation rather than life support — the spine is
 * tens of kilobytes, not megabytes. A failed fetch isn't cached.
 */
export function fetchNav(
	gameId: string,
	gmVisible: boolean,
	fetchFn: Fetcher
): Promise<NavDocument[]> {
	const key = `${gameId}:${gmVisible}`;
	const cached = navCache.get(key);
	if (cached) return cached;
	const file = gmVisible ? 'nav-gm.json' : 'nav.json';
	const promise = getJson<NavDocument[]>(
		fetchFn,
		`${base}/content-packs/${gameId}/rules/${file}`
	).catch((err) => {
		navCache.delete(key);
		throw err;
	});
	navCache.set(key, promise);
	return promise;
}

/**
 * Fetch one section's page artifact, or `null` if the pack has no such id.
 *
 * Deliberately not memoised: a page is a couple of kilobytes and is fetched
 * once per navigation, so a cache keyed by section id would only accumulate
 * thousands of entries in a long-lived Worker isolate to save a fetch the
 * browser and the edge both already cache.
 *
 * The `null` matters. A missing static file under `/content-packs/` does not
 * answer with JSON — Cloudflare Pages serves the SPA's HTML 404 body — so a
 * caller that only checked `res.ok` would surface a JSON parse failure as a
 * 500. Every stale deep link would then miss the reference's own error page,
 * which is precisely the audience it was built for.
 */
export async function fetchPage(
	gameId: string,
	sectionId: string,
	fetchFn: Fetcher
): Promise<ReferencePage | ReferenceRedirect | null> {
	const url = `${base}/content-packs/${gameId}/rules/pages/${encodeURIComponent(sectionId)}.json`;
	const res = await fetchFn(url);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`reference: failed to load ${url} (${res.status})`);
	return (await res.json()) as ReferencePage | ReferenceRedirect;
}

/** Narrow a page artifact to the redirect stub a below-page-depth section gets. */
export function isRedirect(page: ReferencePage | ReferenceRedirect): page is ReferenceRedirect {
	return 'redirectTo' in page;
}

const linkIndexCache = new Map<string, Promise<LinkIndex>>();

/**
 * Fetch a game's wikilink lookup (`link-index.json`, the compact derived
 * artifact `build:search` emits) — for surfaces that print pack text carrying
 * `[[wikilink]]`s but hold no document trees: move cards, steading lines
 * (phase 21). Memoised per game; a failed fetch isn't cached, and callers
 * should treat the index as an enhancement (render text first, link when it
 * lands — `resolveWikilinks` accepts `null`).
 */
export function fetchLinkIndex(gameId: string, fetchFn: Fetcher): Promise<LinkIndex> {
	const cached = linkIndexCache.get(gameId);
	if (cached) return cached;
	const url = `${base}/content-packs/${gameId}/link-index.json`;
	const promise = getJson<SerializedLinkIndex>(fetchFn, url)
		.then(deserializeLinkIndex)
		.catch((err) => {
			linkIndexCache.delete(gameId);
			throw err;
		});
	linkIndexCache.set(gameId, promise);
	return promise;
}
