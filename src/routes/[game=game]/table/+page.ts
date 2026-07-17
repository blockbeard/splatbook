/**
 * The game's table reference (commit 113) — a player-facing handout page
 * (Stonetop: Moves & Gear). Generic shell: the game registers a component and
 * a label through `GameModule.tableReference`; a game without one 404s here,
 * and only serialisable identity crosses the load boundary — the page reaches
 * the component itself through the registry.
 */

import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const game = getGame(params.game);
	if (!game?.tableReference) error(404, 'This game has no table reference.');
	return {
		gameId: game.id,
		gameName: game.name,
		label: game.tableReference.label
	};
};
