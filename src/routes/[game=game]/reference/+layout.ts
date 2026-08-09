import { browser } from '$app/environment';
import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import { fetchNav } from '$lib/reference/load';
import { getLocalPreference, readShowSetting } from '$lib/preferences';
import type { LayoutLoad } from './$types';

/**
 * Load the game's nav spine once for the whole `/reference` subtree: the
 * contents tree lives in the sidebar and is reused across section navigations,
 * while each section page fetches only its own page artifact. GM-only chapters
 * (Book II) are excluded unless the reader has opted into spoilers (commit 97)
 * — by fetching the other artifact, not by filtering here, so an opted-out
 * reader never downloads what the gate withholds (phase 26).
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
export const load: LayoutLoad = async ({ params, url, fetch, data, parent, depends }) => {
	depends('reference:showSetting');
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);

	const { session } = await parent();
	const showSetting = session?.user?.id
		? data.showSettingPref === 'true'
		: browser
			? readShowSetting(params.game, (k) => getLocalPreference(localStorage, k)) === 'true'
			: false;

	const toc = await fetchNav(params.game, showSetting, fetch);
	return {
		/**
		 * Embed mode, readable during SSR.
		 *
		 * `$lib/embed.svelte`'s `active` is browser-only by construction — it reads
		 * `document`. So `{#if embed.active}` renders nothing on the server, and the
		 * search form's hidden `embed` input only exists once the page has hydrated.
		 * A reader who searches before that (or a browser with JS still parsing)
		 * submits a plain GET without it and silently drops out of embed mode, which
		 * on the next load resurrects the app chrome inside the iframe.
		 *
		 * Surfaced here so the input is server-rendered on a direct `?embed=1` load.
		 * The client-side store still matters after SPA navigations, whose URLs drop
		 * the param — the two cover different halves, so the form checks both.
		 */
		embedParam: url.searchParams.get('embed') === '1',
		gameId: params.game,
		gameName: game.name,
		toc,
		showSetting,
		spoilers: game.referenceSpoilers
	};
};
