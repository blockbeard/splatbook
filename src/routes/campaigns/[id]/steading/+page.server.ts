/**
 * The campaign-owned steading (phase 9, commit 63): a steading attached to the
 * campaign, shown to every member. Players get a shared read-only view; the
 * owner (the GM who created it, or whoever they hand the entity to) gets an Edit
 * link to the normal owner-scoped editor.
 *
 * Membership is the gate — a non-member 404s. The steading blob is read through
 * the campaign (`listCampaignEntities`), so a player can see a steading they
 * don't own precisely because they share its campaign.
 */

import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getCampaign, membershipOf } from '$lib/server/db/campaigns';
import { listCampaignEntities } from '$lib/server/db/entities';
import { getGame } from '$lib/games';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) redirect(303, resolve('/campaigns'));

	const campaign = await getCampaign(locals.db, params.id);
	if (!campaign) error(404, 'No such campaign.');
	const seat = await membershipOf(locals.db, campaign.id, session.user.id);
	if (!seat) error(404, 'No such campaign.');

	const [steading] = await listCampaignEntities(locals.db, campaign.id, 'steading');

	return {
		campaign: {
			id: campaign.id,
			name: campaign.name,
			gameId: campaign.gameId,
			gameName: getGame(campaign.gameId)?.name ?? campaign.gameId
		},
		isGm: seat.role === 'gm',
		steading: steading
			? {
					id: steading.id,
					name: steading.name,
					data: steading.data,
					// Only the entity's owner can edit it (the editor is owner-scoped).
					canEdit: steading.userId === session.user.id
				}
			: null
	};
};
