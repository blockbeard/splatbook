/**
 * Preference write endpoint.
 *
 *   PUT /api/preferences  { key, value }  → upsert one preference
 *
 * Signed-in only — a signed-out reader's preference never leaves the browser
 * (`$lib/preferences/client`). No GET here: `locals.prefs` (`hooks.server.ts`)
 * already loads every preference once per request, so a page's own `load`
 * is where a server-rendered read belongs, not a second round trip.
 */

import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { setPreference } from '$lib/server/db/preferences';
import type { RequestHandler } from './$types';

const body = z.strictObject({
	key: z.string().min(1).max(200),
	value: z.string().max(2000)
});

export const PUT: RequestHandler = async ({ locals, request }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to save preferences.');

	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Malformed preference.');

	await setPreference(locals.db, session.user.id, parsed.data.key, parsed.data.value);
	return json({ ok: true });
};
