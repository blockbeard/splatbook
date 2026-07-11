/**
 * End of session — the shell's half.
 *
 * It brings the table (every character attached to the campaign, and the
 * campaign's steading) and a way to write them back; the *game* brings the
 * ritual, through its `sessionComponent`. GM-only: ending the session awards XP
 * to characters their players own, so the one seat allowed to do it is the one
 * running the game.
 *
 * The `save` action persists the blob the game computed in the browser. The
 * shell does not read it, and does not compute awards — `updateCampaignEntityData`
 * enforces the same GM-of-this-campaign rule server-side, so a forged request
 * can't reach a character at another table.
 */

import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { resolve } from '$app/paths';
import { getCampaign, membershipOf } from '$lib/server/db/campaigns';
import { listCampaignEntities, updateCampaignEntityData } from '$lib/server/db/entities';
import { getGame } from '$lib/games';
import type { Actions, PageServerLoad } from './$types';

/** The GM's seat at this campaign, or fail closed. */
async function requireGm(id: string, locals: App.Locals) {
	const session = await locals.auth();
	if (!session?.user?.id) redirect(303, resolve('/campaigns'));
	const campaign = await getCampaign(locals.db, id);
	if (!campaign) error(404, 'No such campaign.');
	const seat = await membershipOf(locals.db, campaign.id, session.user.id);
	// A non-member gets the same 404 as a stranger; a player gets told plainly.
	if (!seat) error(404, 'No such campaign.');
	if (seat.role !== 'gm') error(403, 'Only the GM can end the session.');
	return { userId: session.user.id, campaign };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { campaign } = await requireGm(params.id, locals);

	const [characters, steadings] = await Promise.all([
		listCampaignEntities(locals.db, campaign.id, 'character'),
		listCampaignEntities(locals.db, campaign.id, 'steading')
	]);

	const game = getGame(campaign.gameId);

	return {
		campaign: {
			id: campaign.id,
			name: campaign.name,
			gameId: campaign.gameId,
			gameName: game?.name ?? campaign.gameId
		},
		// The entity `data` is the game's own shape — passed through untouched.
		characters: characters.map((c) => ({
			id: c.id,
			name: c.name || 'Unnamed character',
			data: c.data as object
		})),
		steading: steadings[0]
			? {
					id: steadings[0].id,
					name: steadings[0].name || 'Unnamed steading',
					data: steadings[0].data as object
				}
			: null,
		hasSessionMove: !!game?.sessionComponent
	};
};

const saveBody = z.object({
	entityId: z.string().min(1),
	/** The game's own shape. The shell persists it; it never parses it. */
	data: z.string().min(1)
});

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const { userId } = await requireGm(params.id, locals);

		const form = await request.formData();
		const parsed = saveBody.safeParse({
			entityId: form.get('entityId'),
			data: form.get('data')
		});
		if (!parsed.success) error(400, 'Malformed save.');

		let data: unknown;
		try {
			data = JSON.parse(parsed.data.data);
		} catch {
			error(400, 'Malformed entity data.');
		}

		const updated = await updateCampaignEntityData(locals.db, parsed.data.entityId, userId, data);
		// Not this GM's table, or not attached to it at all.
		if (!updated) error(403, 'That entity is not yours to write.');
		return { saved: updated.id };
	}
};
