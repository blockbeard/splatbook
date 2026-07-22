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
	let saved: {
		id: string;
		name: string;
		data: unknown;
		campaignId: string | null;
	} | null = null;
	// True only when an `?id=` was given and the fetch for it failed — a
	// campaign steading delegate whose grant was revoked is the case that
	// matters: the GET 404s (the server re-checks the grant fresh, so this is
	// the source of truth), and the page must not treat that the same as "no
	// id given, start a blank draft" — an editor-first type would otherwise
	// silently hand back an empty steading with no sign anything's wrong. See
	// the `{#if !character}` branch in +page.svelte.
	let idDenied = false;
	if (id) {
		const res = await fetch(`/api/entities/${id}`);
		if (res.ok) {
			const entity = await res.json();
			// `campaignId` decides whether rolls persist to a shared log (commit 67):
			// a character attached to a campaign logs its rolls; a loose one rolls
			// locally.
			saved = {
				id: entity.id,
				name: entity.name,
				data: entity.data,
				campaignId: entity.campaignId ?? null
			};
		} else {
			idDenied = true;
		}
	}

	return {
		gameId: game.id,
		gameName: game.name,
		entityType: params.type,
		typeLabel: type.label,
		editorFirst,
		hasSheet: !!type.sheetComponent,
		saved,
		idDenied
	};
};
