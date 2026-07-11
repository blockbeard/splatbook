/**
 * Campaign roll log endpoint.
 *
 *  GET  /api/campaigns/<id>/rolls  → the campaign's recent log, newest first
 *  POST /api/campaigns/<id>/rolls  → append a roll to the campaign's log
 *
 * Both are session- and membership-guarded (a non-member gets 404 on read, 403
 * on write — the write path leans on the service's own membership check). The
 * roll is computed in the browser by the dice roller, so on POST the body is
 * validated against `rollResultSchema` before it's trusted. GET drives the live
 * table view, which polls it (commit 68).
 */

import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { rollResultSchema } from '$lib/dice';
import { db } from '$lib/server/db';
import { membershipOf } from '$lib/server/db/campaigns';
import { logRoll, listCampaignRolls, toLogEntry } from '$lib/server/db/rolls';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to view the roll log.');
	// Not a member (or no such campaign) → 404, same as the campaign page.
	const seat = await membershipOf(db, params.id, session.user.id);
	if (!seat) error(404, 'No such campaign.');

	const rolls = await listCampaignRolls(db, params.id);
	return json({ rolls: rolls.map(toLogEntry) });
};

const body = z.strictObject({
	label: z.string().min(1).max(120),
	/** Who rolled, in the fiction. Optional: a roll with no character in play
	 * (a GM rolling loose) is still a roll. */
	characterName: z.string().min(1).max(120).nullish(),
	result: rollResultSchema
});

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to roll.');

	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Malformed roll.');

	const row = await logRoll(db, {
		campaignId: params.id,
		actorId: session.user.id,
		characterName: parsed.data.characterName,
		label: parsed.data.label,
		result: parsed.data.result
	});
	// `undefined` means the signed-in user isn't a member of this campaign.
	if (!row) error(403, 'You are not a member of this campaign.');

	return json({ id: row.id, createdAt: row.createdAt }, { status: 201 });
};
