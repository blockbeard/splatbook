import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	// Only serialisable identity crosses the load boundary; components reach
	// the full module through the registry themselves.
	return { gameId: game.id, gameName: game.name };
};
