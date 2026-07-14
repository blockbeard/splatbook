import { base } from '$app/paths';
import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { LayoutLoad } from './$types';

/**
 * Load the game's GM guide once for the whole `/gm` subtree: the section nav
 * (rendered in the sidebar) and the guide's reference data (`packFile` from the
 * game module). The data is validated at build/CI by `validate:packs`, so the
 * runtime trusts the fetched JSON and passes it opaquely to the game's guide
 * component. A game with no `gmGuide` has no GM tools — 404.
 */
export const load: LayoutLoad = async ({ params, fetch }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	const guide = game.gmGuide;
	if (!guide) error(404, `${game.name} has no GM guide`);

	const url = `${base}/content-packs/${params.game}/${guide.packFile}`;
	const res = await fetch(url);
	if (!res.ok) error(500, `Failed to load GM guide data (${res.status})`);
	const data: unknown = await res.json();

	return { gameId: params.game, gameName: game.name, sections: guide.sections, data };
};
