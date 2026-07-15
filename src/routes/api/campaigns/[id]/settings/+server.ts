/**
 * Campaign settings — read-only endpoint (commit 105).
 *
 *  GET /api/campaigns/<id>/settings → the campaign's settings blob
 *
 * Any seated member may read it (a player's own play sheet needs this to
 * decide whether to show locked Arcana mysteries, e.g.) — writing is GM-only
 * and goes through the campaign dashboard's `updateSettings` form action, not
 * this endpoint.
 */

import { json, error } from '@sveltejs/kit';
import { getCampaignSettings, membershipOf } from '$lib/server/db/campaigns';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to view campaign settings.');
	// Not a member (or no such campaign) → 404, same as the campaign page.
	const seat = await membershipOf(locals.db, params.id, session.user.id);
	if (!seat) error(404, 'No such campaign.');

	const settings = await getCampaignSettings(locals.db, params.id);
	return json(settings);
};
