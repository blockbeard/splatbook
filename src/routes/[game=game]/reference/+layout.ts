import { browser } from '$app/environment';
import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import { fetchTrees, tocOf, isVisible } from '$lib/reference/load';
import { getLocalPreference, REFERENCE_SHOW_SETTING } from '$lib/preferences';
import type { LayoutLoad } from './$types';

/**
 * Load the game's rules reference once for the whole `/reference` subtree: the
 * table of contents (bodies stripped) lives in the sidebar and is reused across
 * section navigations; section pages fetch the full trees themselves (the JSON
 * is browser-cached, so that fetch is free). GM-only sections (Book II) are
 * filtered out unless the reader has opted into spoilers (commit 97).
 *
 * `showSetting` — the resolved opt-in — comes from two places depending on
 * whether the viewer is signed in:
 *  - **signed in**: the sibling `+layout.server.ts`'s `showSettingPref`
 *    (`locals.prefs`) is authoritative. A stale `localStorage` value from
 *    before they signed in is deliberately ignored — the server row is the
 *    account's decision now.
 *  - **signed out**: there is no server-side preference to load (a signed-out
 *    request never populates `locals.prefs`), so the browser's own
 *    `localStorage` copy decides. That's unreadable during SSR, so the very
 *    first paint defaults closed; `depends()` below lets the checkbox (or the
 *    interstitial's opt-in button, both of which write `localStorage` then
 *    call `invalidate`) pull the real value in on the next run, which happens
 *    in the browser where `localStorage` exists.
 */
export const load: LayoutLoad = async ({ params, fetch, data, parent, depends }) => {
	depends('reference:showSetting');
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);

	const { session } = await parent();
	const showSetting = session?.user?.id
		? data.showSettingPref === 'true'
		: browser
			? getLocalPreference(localStorage, REFERENCE_SHOW_SETTING) === 'true'
			: false;

	const trees = await fetchTrees(params.game, fetch);
	const toc = tocOf(trees, (s) => isVisible(s, showSetting)).filter(
		(doc) => doc.sections.length > 0
	);
	return {
		gameId: params.game,
		gameName: game.name,
		toc,
		showSetting,
		spoilers: game.referenceSpoilers
	};
};
