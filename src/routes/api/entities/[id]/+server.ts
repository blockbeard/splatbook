/**
 * Single saved-entity endpoint.
 *
 *  GET    /api/entities/<id>  → load one entity the user owns
 *  PATCH  /api/entities/<id>  → rename and/or change status (archive/unarchive)
 *  DELETE /api/entities/<id>  → remove it
 *
 * All session-guarded and ownership-scoped by the entity service. The dashboard
 * drives PATCH/DELETE; duplication is the sibling `duplicate` route.
 */

import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { getEntity, updateEntity, deleteEntity } from '$lib/server/db/entities';
import type { RequestHandler } from './$types';

async function requireUserId(locals: App.Locals): Promise<string> {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to manage characters.');
	return session.user.id;
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const userId = await requireUserId(locals);
	const entity = await getEntity(locals.db, params.id, userId);
	if (!entity) error(404, 'No such entity.');
	return json(entity);
};

const patchBody = z
	.object({
		name: z.string().min(1).optional(),
		status: z.enum(['draft', 'ready', 'archived']).optional()
	})
	.refine((b) => b.name !== undefined || b.status !== undefined, {
		message: 'Nothing to update.'
	});

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const userId = await requireUserId(locals);
	const parsed = patchBody.safeParse(await request.json());
	if (!parsed.success) error(400, 'Malformed update.');
	const updated = await updateEntity(locals.db, params.id, userId, parsed.data);
	if (!updated) error(404, 'No such entity.');
	return json(updated);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const userId = await requireUserId(locals);
	const removed = await deleteEntity(locals.db, params.id, userId);
	if (!removed) error(404, 'No such entity.');
	return new Response(null, { status: 204 });
};
