/**
 * Single saved-entity endpoint. `GET /api/entities/<id>` loads one entity the
 * signed-in user owns (used to resume a draft in the builder or render a saved
 * sheet). The dashboard's mutations — archive, delete, duplicate — land on this
 * route in commit 33; the underlying service functions already exist.
 */

import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getEntity } from '$lib/server/db/entities';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to load characters.');
	const entity = await getEntity(db, params.id, session.user.id);
	if (!entity) error(404, 'No such entity.');
	return json(entity);
};
