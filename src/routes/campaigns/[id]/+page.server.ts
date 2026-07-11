/**
 * A single campaign. Membership is the gate: only a seated member (GM or player)
 * may view it; anyone else gets a 404 (not 403 — we don't confirm the campaign
 * exists to non-members). The GM additionally sees the invite link and can
 * rotate it to revoke outstanding invites.
 *
 * The party-at-a-glance and campaign steading are added in commits 61 and 63;
 * this commit establishes the page, the access gate, and the invite plumbing.
 */

import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { db } from '$lib/server/db';
import { getCampaign, membershipOf, rotateInviteToken } from '$lib/server/db/campaigns';
import { getGame } from '$lib/games';
import type { Actions, PageServerLoad } from './$types';

/** The path a newcomer follows to join (made absolute in the browser). */
export const joinPath = (token: string) => `/campaigns/join/${token}`;

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) redirect(303, resolve('/campaigns'));

	const campaign = await getCampaign(db, params.id);
	if (!campaign) error(404, 'No such campaign.');
	const seat = await membershipOf(db, campaign.id, session.user.id);
	if (!seat) error(404, 'No such campaign.');

	const isGm = seat.role === 'gm';
	return {
		campaign: {
			id: campaign.id,
			name: campaign.name,
			gameId: campaign.gameId,
			gameName: getGame(campaign.gameId)?.name ?? campaign.gameId
		},
		role: seat.role,
		isGm,
		// The invite capability is GM-only; players never receive the token.
		invite: isGm ? { path: joinPath(campaign.inviteToken) } : null
	};
};

export const actions: Actions = {
	rotate: async ({ params, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) error(401, 'Sign in.');
		const rotated = await rotateInviteToken(db, params.id, session.user.id);
		if (!rotated) error(403, 'Only the campaign owner can rotate the invite.');
		return { rotated: { path: joinPath(rotated.inviteToken) } };
	}
};
