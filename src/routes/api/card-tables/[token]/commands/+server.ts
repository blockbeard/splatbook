/**
 * Applying a command to a card table (phase 29).
 *
 *   POST /api/card-tables/<token>/commands
 *   { command, expectedVersion, requestHash }
 *
 * The seat comes from the request rather than the body — a client cannot say
 * who it is, only prove it — and only an admitted seat may act. `requestHash`
 * is the client's own idempotency key: the same command retried under the same
 * key lands once, which is what makes a dropped response safe to retry.
 */

import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { loadTable, runCommand, viewFor } from '$lib/server/card-tables/service';
import type { RequestHandler } from './$types';

const body = z.strictObject({
	command: z.unknown(),
	expectedVersion: z.number().int().min(0),
	/** Stable across retries of one command, different for a new one. */
	requestHash: z.string().min(8).max(200)
});

export const POST: RequestHandler = async ({ locals, params, request, fetch }) => {
	const session = await locals.auth();
	const table = await loadTable(
		locals.db,
		fetch,
		params.token,
		locals.seatClaims[params.token],
		session?.user?.id
	);
	if (!table) error(404, 'No such table.');

	// Holding the room link is not sitting at the table. Somebody still waiting
	// on the GM can watch and cannot act.
	if (!table.seat || table.seat.status !== 'admitted') error(403, 'You have no seat here.');

	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Malformed command.');

	const result = await runCommand(
		locals.db,
		table,
		parsed.data.command,
		parsed.data.expectedVersion,
		parsed.data.requestHash
	);

	if (!result.ok) {
		// A lost race is ordinary and the client should re-sync; the rest are
		// terminal for that table, and a client must be able to tell them apart
		// or it will retry a finished table forever.
		const status = result.reason === 'conflict' ? 409 : result.reason === 'rejected' ? 422 : 410;
		return json({ ok: false, reason: result.reason, detail: result.detail }, { status });
	}

	const fresh = await loadTable(
		locals.db,
		fetch,
		params.token,
		locals.seatClaims[params.token],
		session?.user?.id
	);
	if (!fresh) error(404, 'No such table.');
	return json({ ok: true, ...(await viewFor(locals.db, fresh, parsed.data.expectedVersion)) });
};
