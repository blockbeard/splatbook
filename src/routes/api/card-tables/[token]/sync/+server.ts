/**
 * The poll endpoint (phase 29).
 *
 *   GET /api/card-tables/<token>/sync?since=<version>&stamp=<stamp>
 *
 * Read-only, deliberately and load-bearingly. Every client at a table asks this
 * about once a second, so it must not write: expiry is a read-time judgement
 * here and the actual deletion happens on page loads, and the table's activity
 * timestamp is refreshed there too. A poll that wrote would turn a quiet table
 * into a steady stream of billed writes.
 *
 * The reply is the table *as this seat may see it* — the game's projection, the
 * only thing a client is ever handed — plus public events since the cursor the
 * client sent.
 *
 * Or no reply at all. A client that sends back the `stamp` from its last view
 * is answered `204` when neither the version nor the roster has moved, from a
 * single statement and without the table's state being read (`syncTable`).
 */

import { error, json } from '@sveltejs/kit';
import { syncTable } from '$lib/server/card-tables/service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url, fetch }) => {
	const session = await locals.auth();
	const since = Number(url.searchParams.get('since') ?? '0');
	const view = await syncTable(
		locals.db,
		fetch,
		params.token,
		locals.seatClaims[params.token],
		session?.user?.id,
		{
			since: Number.isFinite(since) ? since : 0,
			stamp: url.searchParams.get('stamp') ?? undefined
		}
	);
	// A token that names no table and one whose table has expired are the same
	// answer on purpose: neither reveals whether it ever existed.
	if (!view) error(404, 'No such table.');

	// Nothing has moved since the client last asked — the usual case by a wide
	// margin. No body: the client keeps what it has.
	if (view === 'unchanged') return new Response(null, { status: 204 });
	return json(view);
};
