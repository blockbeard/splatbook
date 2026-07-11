/**
 * `POST /api/entities/<id>/duplicate` — clone an owned entity into a fresh
 * draft named "… (copy)". Session-guarded; the service refuses to copy another
 * user's entity. Returns the new entity.
 */

import { json, error } from '@sveltejs/kit';
import { duplicateEntity } from '$lib/server/db/entities';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to duplicate characters.');
	const copy = await duplicateEntity(locals.db, params.id, session.user.id);
	if (!copy) error(404, 'No such entity.');
	return json(copy, { status: 201 });
};
