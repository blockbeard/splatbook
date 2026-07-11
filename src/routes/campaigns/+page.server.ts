/**
 * Campaigns list + create. Shows the signed-in user's campaigns (from any game)
 * with their role, and a form to start a new one. Signed out, it returns
 * `signedIn: false` so the page can prompt to sign in rather than 401.
 *
 * Creating is a form action (progressive enhancement): it seats the creator as
 * GM and redirects to the new campaign, where the invite link lives.
 */

import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { db } from '$lib/server/db';
import { createCampaign, listCampaignsForUser } from '$lib/server/db/campaigns';
import { getGame, listGames } from '$lib/games';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return { signedIn: false, campaigns: [], games: [] };

	const rows = await listCampaignsForUser(db, session.user.id);
	const campaigns = rows.map((c) => ({
		id: c.id,
		name: c.name,
		gameId: c.gameId,
		gameName: getGame(c.gameId)?.name ?? c.gameId,
		role: c.role,
		updatedAt: c.updatedAt.toISOString()
	}));
	// Only offer games that actually exist to start a campaign in.
	const games = listGames().map((g) => ({ id: g.id, name: g.name }));
	return { signedIn: true, campaigns, games };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) error(401, 'Sign in to start a campaign.');

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const gameId = String(form.get('gameId') ?? '').trim();
		if (!name) return { create: { error: 'Give the campaign a name.' } };
		if (!getGame(gameId)) return { create: { error: 'Pick a game.' } };

		const campaign = await createCampaign(db, { gameId, name, ownerId: session.user.id });
		redirect(303, resolve('/campaigns/[id]', { id: campaign.id }));
	}
};
