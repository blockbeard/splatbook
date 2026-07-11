import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import { fetchTrees, tocOf, isVisible } from '$lib/reference/load';
import type { LayoutLoad } from './$types';

/**
 * Load the game's rules reference once for the whole `/reference` subtree: the
 * table of contents (bodies stripped) lives in the sidebar and is reused across
 * section navigations; section pages fetch the full trees themselves (the JSON
 * is browser-cached, so that fetch is free). GM-only sections (Book II) are
 * filtered out unless the viewer is a campaign GM — the gate value comes from
 * the sibling `+layout.server.ts` via `parent()`.
 */
export const load: LayoutLoad = async ({ params, fetch, data }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	// `gmContentVisible` is computed by the sibling +layout.server.ts and arrives
	// here as `data` (not via parent(), which is ancestor layouts only).
	const { gmContentVisible } = data;
	const trees = await fetchTrees(params.game, fetch);
	const toc = tocOf(trees, (s) => isVisible(s, gmContentVisible)).filter(
		(doc) => doc.sections.length > 0
	);
	return { gameId: params.game, gameName: game.name, toc, gmContentVisible };
};
