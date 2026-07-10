import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	if (!game.sheetComponent) error(404, `${game.name} has no character sheet yet`);
	return { gameId: game.id, gameName: game.name };
};
