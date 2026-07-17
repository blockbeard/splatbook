import { error } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import type { PageLoad } from './$types';

/** A "create one" action the landing page offers, one per creatable entity type.
 * `via` picks the route: create-flow types (characters) go to the builder,
 * editor-first types (steadings) straight to the editor. */
export interface CreateAction {
	entityType: string;
	label: string;
	via: 'build' | 'play';
}

export const load: PageLoad = ({ params }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);

	// Iterate the entity-type map rather than hard-coding "character": each type
	// that can be created contributes a button, in registration order.
	const creators: CreateAction[] = Object.entries(game.entityTypes)
		.filter(([, t]) => t.newDraft)
		.map(([entityType, t]) => ({
			entityType,
			label: t.label,
			via: t.wizardSteps?.length ? 'build' : 'play'
		}));

	// Only serialisable identity crosses the load boundary; components reach
	// the full module through the registry themselves.
	return {
		gameId: game.id,
		gameName: game.name,
		creators,
		hasGmGuide: !!game.gmGuide,
		// The player-facing handout page, if this game registered one (commit 113).
		tableReferenceLabel: game.tableReference?.label ?? null
	};
};
