import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import { fetchTrees, tocOf } from '$lib/reference/load';
import type { LayoutLoad } from './$types';

/**
 * Load the game's rules reference once for the whole `/reference` subtree: the
 * table of contents (bodies stripped) lives in the sidebar and is reused across
 * section navigations; section pages fetch the full trees themselves (the JSON
 * is browser-cached, so that fetch is free).
 */
export const load: LayoutLoad = async ({ params, fetch }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	const trees = await fetchTrees(params.game, fetch);
	return { gameId: params.game, gameName: game.name, toc: tocOf(trees) };
};
