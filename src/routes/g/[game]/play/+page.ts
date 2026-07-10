import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url, fetch }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	if (!game.playComponent) error(404, `${game.name} has no play mode yet`);

	// `?id=` plays a saved entity from the database (edits autosave back to it);
	// without it, play mode edits the same local autosave slot the sheet reads.
	const id = url.searchParams.get('id');
	let saved: { id: string; name: string; data: unknown } | null = null;
	if (id) {
		const res = await fetch(`/api/entities/${id}`);
		if (res.ok) {
			const entity = await res.json();
			saved = { id: entity.id, name: entity.name, data: entity.data };
		}
	}

	return { gameId: game.id, gameName: game.name, saved };
};
