/**
 * Arcana authoring (commit 105) — the shell's half. GM-only, same access
 * pattern as end-of-session: brings the table's characters and a GM-checked
 * write-through, and leaves the actual authoring to the game's own
 * `arcanaGmComponent`. The shell never reads or writes an arcana card itself.
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
	if (seat.role !== 'gm') error(403, 'Only the GM can author Arcana.');
	return { userId: session.user.id, campaign };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { campaign } = await requireGm(params.id, locals);

	const characters = await listCampaignEntities(locals.db, campaign.id, 'character');
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
		hasArcanaGm: !!game?.arcanaGmComponent
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
