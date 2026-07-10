import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url, fetch }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);
	const type = game.entityTypes[params.type];
	if (!type?.playComponent) error(404, `${game.name} ${params.type} has no editor yet`);

	// Editor-first types (steadings) have no wizard, so "create new" lands here;
	// the page seeds a blank draft when there's nothing saved or autosaved.
	const editorFirst = !type.wizardSteps?.length && !!type.newDraft;

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

	return {
		gameId: game.id,
		gameName: game.name,
		entityType: params.type,
		typeLabel: type.label,
		editorFirst,
		hasSheet: !!type.sheetComponent,
		saved
	};
};
