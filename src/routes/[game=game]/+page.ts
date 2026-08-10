import { error } from '@sveltejs/kit';
import { base } from '$app/paths';
import { getGame } from '$lib/games';
import { licenseInfo, type LicenseInfo } from '$lib/credits';
import { landingSchema, type GameLanding } from '$lib/packs/landing';
import type { PackManifest } from '$lib/packs/types';
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

	/**
	 * Whose text this is, from the pack's own manifest — the same two fields
	 * `/credits` builds its table from, so the front door and the credits page
	 * can't drift apart or need a second copy to maintain.
	 *
	 * On the page for a game a visitor may well believe is publishing it, the
	 * provenance belongs *here*, not one click away in the footer: HMtW's
	 * manifest already carries the compatibility statement its license requires
	 * ("not affiliated with Joshua McCrowell or Exalted Funeral") and it was
	 * appearing nowhere a reader of `/hmtw` would meet it.
	 */
	let attribution: string | null = null;
	let license: LicenseInfo | null = null;
	const manifestRes = await fetch(`${base}/content-packs/${game.id}/manifest.json`);
	if (manifestRes.ok) {
		const m = (await manifestRes.json()) as PackManifest;
		attribution = m.attribution ?? null;
		license = m.license ? licenseInfo(m.license) : null;
	}

	// Only serialisable identity crosses the load boundary; components reach
	// the full module through the registry themselves.
	return {
		attribution,
		license,
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
