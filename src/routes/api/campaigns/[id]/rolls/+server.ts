/**
 * Campaign roll log endpoint.
 *
 *  POST /api/campaigns/<id>/rolls  → append a roll to the campaign's log
 *
 * Session-guarded; membership is enforced by the service (`logRoll` refuses a
 * non-member, which we map to 403). The roll is computed in the browser by the
 * dice roller, so the body is validated against `rollResultSchema` before it's
 * trusted — the label is the game's move text, the result the engine's outcome.
 *
 * The live read side (GET, with polling) lands in commit 68.
 */

import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { rollResultSchema } from '$lib/dice';
import { db } from '$lib/server/db';
import { logRoll } from '$lib/server/db/rolls';
import type { RequestHandler } from './$types';

const body = z.strictObject({
	label: z.string().min(1).max(120),
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
		label: parsed.data.label,
		result: parsed.data.result
	});
	// `undefined` means the signed-in user isn't a member of this campaign.
	if (!row) error(403, 'You are not a member of this campaign.');

	return json({ id: row.id, createdAt: row.createdAt }, { status: 201 });
};
