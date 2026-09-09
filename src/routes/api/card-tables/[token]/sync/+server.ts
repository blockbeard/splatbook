/**
 * The poll endpoint (phase 29).
 *
 *   GET /api/card-tables/<token>/sync?since=<version>
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
 */

import { error, json } from '@sveltejs/kit';
import { loadTable, viewFor } from '$lib/server/card-tables/service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url, fetch }) => {
	const session = await locals.auth();
	const table = await loadTable(
		locals.db,
		fetch,
		params.token,
		locals.seatClaims[params.token],
		session?.user?.id
	);
	// A token that names no table and one whose table has expired are the same
	// answer on purpose: neither reveals whether it ever existed.
	if (!table) error(404, 'No such table.');

	const since = Number(url.searchParams.get('since') ?? '0');
	return json(await viewFor(locals.db, table, Number.isFinite(since) ? since : 0));
};
