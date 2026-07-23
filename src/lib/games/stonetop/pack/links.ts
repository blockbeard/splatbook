/**
 * Stonetop's wikilink resolution for pack text (phase 21). Pack data quotes
 * the vault's own cross-references — a basic move ends "see
 * `[[06 - Player Moves#^clash|Clash]]`" — and every surface that prints such
 * text (move cards on `/stonetop/table`, the play-mode Moves tab, steading
 * lines) runs it through here so the reader gets a real in-app link, or at
 * worst plain prose, never raw `[[…]]` syntax.
 *
 * The lookup is the pack's derived `link-index.json` (~170 KB), not the 3 MB
 * of rules trees; `fetchLinkIndex` memoises it per game. Rendering shouldn't
 * wait on it: fetch it non-fatally, pass `null` until it lands, and the text
 * shows with bare labels that upgrade to links on arrival.
 */

import { resolve } from '$app/paths';
import { fetchLinkIndex } from '$lib/reference/load';
import { resolveWikilinks, type LinkIndex } from '$lib/reference/inline';

const GAME_ID = 'stonetop';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** The stonetop wikilink lookup (memoised across surfaces by `fetchLinkIndex`). */
export function fetchStonetopLinkIndex(fetchFn: Fetcher): Promise<LinkIndex> {
	return fetchLinkIndex(GAME_ID, fetchFn);
}

/**
 * Pack text with its wikilinks resolved to `/stonetop/reference/<section>`
 * markdown links (or degraded to bare labels — no index, no match). Feed the
 * result to the existing `Markdown` component; it handles the rest of the
 * string's emphasis/lists as before.
 */
export function resolvePackText(text: string, index: LinkIndex | null): string {
	return resolveWikilinks(text, index, (id) =>
		resolve('/[game=game]/reference/[section]', { game: GAME_ID, section: id })
	);
}
