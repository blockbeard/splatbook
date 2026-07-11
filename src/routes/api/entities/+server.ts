/**
 * Saved-entity collection endpoint.
 *
 *  GET  /api/entities[?game=&type=&archived=true]  → the signed-in user's list
 *  POST /api/entities                              → create, or update when the
 *                                                    body carries an `id`
 *
 * Both require a session; the entity service scopes every query by the user id
 * so ownership can't be spoofed from the request. The body is opaque `data`
 * plus the columns the game module's `entityMeta` produced on the client.
 */

import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { createEntity, updateEntity, listEntities } from '$lib/server/db/entities';
import type { RequestHandler } from './$types';

const saveBody = z.object({
	id: z.string().optional(),
	gameId: z.string().min(1),
	entityType: z.string().min(1),
	name: z.string(),
	data: z.unknown(),
	schemaVersion: z.number().int().nonnegative(),
	status: z.enum(['draft', 'ready', 'archived']).optional()
});

async function requireUserId(locals: App.Locals): Promise<string> {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to save characters.');
	return session.user.id;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	const userId = await requireUserId(locals);
	const rows = await listEntities(locals.db, userId, {
		gameId: url.searchParams.get('game') ?? undefined,
		entityType: url.searchParams.get('type') ?? undefined,
		includeArchived: url.searchParams.get('archived') === 'true'
	});
	return json(rows);
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = await requireUserId(locals);
	const parsed = saveBody.safeParse(await request.json());
	if (!parsed.success) error(400, 'Malformed entity payload.');
	const body = parsed.data;

	if (body.id) {
		const updated = await updateEntity(locals.db, body.id, userId, {
			name: body.name,
			data: body.data,
			schemaVersion: body.schemaVersion,
			status: body.status
		});
		if (!updated) error(404, 'No such entity.');
		return json(updated);
	}

	const created = await createEntity(locals.db, {
		userId,
		gameId: body.gameId,
		entityType: body.entityType,
		name: body.name,
		data: body.data,
		schemaVersion: body.schemaVersion,
		status: body.status
	});
	return json(created, { status: 201 });
};
