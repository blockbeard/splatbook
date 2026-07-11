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
import { getEntity, listEntities, setEntityCampaign } from '$lib/server/db/entities';
import { getGame } from '$lib/games';
import type { Actions, PageServerLoad } from './$types';

/** The path a newcomer follows to join (made absolute in the browser). */
export const joinPath = (token: string) => `/campaigns/join/${token}`;

/** Load a member's session + campaign seat, or fail closed. Shared by load + actions. */
async function requireSeat(id: string, locals: App.Locals) {
	const session = await locals.auth();
	if (!session?.user?.id) redirect(303, resolve('/campaigns'));
	const campaign = await getCampaign(db, id);
	if (!campaign) error(404, 'No such campaign.');
	const seat = await membershipOf(db, campaign.id, session.user.id);
	if (!seat) error(404, 'No such campaign.');
	return { userId: session.user.id, campaign, seat };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { userId, campaign, seat } = await requireSeat(params.id, locals);
	const isGm = seat.role === 'gm';

	// The viewer's own characters for this game, with their attachment state, so
	// they can attach one to (or detach it from) this campaign.
	const mine = await listEntities(db, userId, {
		gameId: campaign.gameId,
		entityType: 'character'
	});
	const myCharacters = mine.map((c) => ({
		id: c.id,
		name: c.name,
		attachedHere: c.campaignId === campaign.id,
		// Attached to a different campaign — a character belongs to only one.
		attachedElsewhere: c.campaignId != null && c.campaignId !== campaign.id
	}));

	return {
		campaign: {
			id: campaign.id,
			name: campaign.name,
			gameId: campaign.gameId,
			gameName: getGame(campaign.gameId)?.name ?? campaign.gameId
		},
		role: seat.role,
		isGm,
		myCharacters,
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
	},

	attach: async ({ params, request, locals }) => {
		const { userId, campaign } = await requireSeat(params.id, locals);
		const entityId = String((await request.formData()).get('entityId') ?? '');
		const entity = await getEntity(db, entityId, userId);
		// Own it, and it must belong to this campaign's game.
		if (!entity || entity.gameId !== campaign.gameId) {
			error(400, 'That character can’t be attached to this campaign.');
		}
		await setEntityCampaign(db, entityId, userId, campaign.id);
		return { attach: { ok: true } };
	},

	detach: async ({ params, request, locals }) => {
		const { userId } = await requireSeat(params.id, locals);
		const entityId = String((await request.formData()).get('entityId') ?? '');
		await setEntityCampaign(db, entityId, userId, null);
		return { detach: { ok: true } };
	}
};
