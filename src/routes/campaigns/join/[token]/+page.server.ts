/**
 * Join-by-invite. Opening `/campaigns/join/<token>` shows a confirmation ("Join
 * <campaign>?") and, on submit, seats the viewer as a player. The token is a
 * capability: a valid one reveals only the campaign's name, and an unknown token
 * 404s without hinting at what exists.
 *
 * Signed out, the page prompts to sign in and comes back here (the token is in
 * the URL, so the round-trip preserves it). Already a member? Straight through
 * to the campaign.
 */

import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { db } from '$lib/server/db';
import { getCampaignByToken, membershipOf, joinCampaign } from '$lib/server/db/campaigns';
import { getGame } from '$lib/games';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const campaign = await getCampaignByToken(db, params.token);
	if (!campaign) error(404, 'This invite link is not valid.');

	const session = await locals.auth();
	const view = {
		name: campaign.name,
		gameName: getGame(campaign.gameId)?.name ?? campaign.gameId
	};
	if (!session?.user?.id) return { signedIn: false, campaign: view };

	// Already seated — no need to confirm, just go to the campaign.
	const seat = await membershipOf(db, campaign.id, session.user.id);
	if (seat) redirect(303, resolve('/campaigns/[id]', { id: campaign.id }));

	return { signedIn: true, campaign: view };
};

export const actions: Actions = {
	join: async ({ params, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) error(401, 'Sign in to join.');
		const result = await joinCampaign(db, params.token, session.user.id);
		if (!result) error(404, 'This invite link is not valid.');
		redirect(303, resolve('/campaigns/[id]', { id: result.campaign.id }));
	}
};
