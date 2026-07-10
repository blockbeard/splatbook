import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url, fetch }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	const type = game.entityTypes[params.type];
	if (!type?.sheetComponent) error(404, `${game.name} ${params.type} has no sheet yet`);

	// `?id=` renders a saved entity from the database; without it the sheet falls
	// back to the local autosave slot (client-side, see +page.svelte).
	const id = url.searchParams.get('id');
	let saved: { name: string; data: unknown } | null = null;
	if (id) {
		const res = await fetch(`/api/entities/${id}`);
		if (res.ok) {
			const entity = await res.json();
			saved = { name: entity.name, data: entity.data };
		}
	}

	return {
		gameId: game.id,
		gameName: game.name,
		entityType: params.type,
		typeLabel: type.label,
		hasWizard: !!type.wizardSteps?.length,
		hasPlay: !!type.playComponent,
		saved
	};
};
