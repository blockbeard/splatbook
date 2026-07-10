import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	if (!game.wizardSteps?.length || !game.newDraft) {
		error(404, `${game.name} has no character builder yet`);
	}
	// Only serialisable identity crosses the load boundary; the page reaches the
	// module (steps, draft factory) through the registry itself.
	return { gameId: game.id, gameName: game.name };
};
