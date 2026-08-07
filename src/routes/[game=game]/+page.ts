import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import { getGame } from '$lib/games';
import { landingSchema, type GameLanding } from '$lib/packs/landing';
import type { PageLoad } from './$types';

/** A "create one" action the landing page offers, one per creatable entity type.
 * `via` picks the route: create-flow types (characters) go to the builder,
 * editor-first types (steadings) straight to the editor. */
export interface CreateAction {
	entityType: string;
	label: string;
	via: 'build' | 'play';
}

export const load: PageLoad = async ({ params, fetch }) => {
	const game = getGame(params.game);
	if (!game) error(404, `No such game: "${params.game}"`);

	// Iterate the entity-type map rather than hard-coding "character": each type
	// that can be created contributes a button, in registration order.
	const creators: CreateAction[] = Object.entries(game.entityTypes ?? {})
		.filter(([, t]) => t.newDraft)
		.map(([entityType, t]) => ({
			entityType,
			label: t.label,
			via: t.wizardSteps?.length ? 'build' : 'play'
		}));

	// The pack's own front-door copy (phase 22) — optional; a pack without a
	// landing.json (a 404) gets the shell's honest defaults.
	let landing: GameLanding | null = null;
	const res = await fetch(`${base}/content-packs/${game.id}/landing.json`);
	if (res.ok) landing = landingSchema.parse(await res.json());
	else if (res.status !== 404) error(res.status as never, 'Failed to load the game landing');

	// Only serialisable identity crosses the load boundary; components reach
	// the full module through the registry themselves.
	return {
		gameId: game.id,
		gameName: game.name,
		creators,
		landing,
		// A reference-only game (no entity types) has nothing for a campaign to
		// do — creation is gated the same way (see campaigns/+page.server.ts).
		hasCampaigns: Object.keys(game.entityTypes ?? {}).length > 0,
		hasGmGuide: !!game.gmGuide,
		// The player-facing handout page, if this game registered one (commit 113).
		tableReferenceLabel: game.tableReference?.label ?? null
	};
};
