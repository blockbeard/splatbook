/**
 * A card table's picture (phase 31).
 *
 *   PUT /api/card-tables/<token>/picture   { dataUrl }   → the table, as /commands
 *   GET /api/card-tables/<token>/picture?id=<id>        → the data: URL, as text
 *
 * Putting one up is the GM's (anyone's, while nobody holds the GM seat — the
 * table's own rule). The bytes are checked and stored first, then the table is
 * told about them with an ordinary `set-scene-picture` command, so the change
 * rides the version, the event log and every client's poll like any other.
 * Taking one down is just the `clear-scene-picture` command; the commands
 * endpoint deletes the bytes when the table stops naming them.
 *
 * Reading it needs only the room link, the same as seeing the table. It is
 * served as the text it was stored as, which the browser shows directly — no
 * decoding on the server, which is the point of storing it that way.
 */

import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { loadTable, runCommand, viewFor } from '$lib/server/card-tables/service';
import {
	checkPicture,
	getPicture,
	keepOnlyPicture,
	putPicture
} from '$lib/server/db/card-table-pictures';
import { MAX_PICTURE_BYTES } from '$lib/card-table-limits';
import type { RequestHandler } from './$types';

const body = z.strictObject({ dataUrl: z.string().min(1) });

/** A little over the base64 length of the largest picture, for the envelope. */
const MAX_BODY_CHARS = Math.ceil(MAX_PICTURE_BYTES / 3) * 4 + 200;

export const PUT: RequestHandler = async ({ locals, params, request, fetch }) => {
	const session = await locals.auth();
	const load = () =>
		loadTable(locals.db, fetch, params.token, locals.seatClaims[params.token], session?.user?.id);
	let table = await load();
	if (!table) error(404, 'No such table.');
	if (!table.module.pictureOf) error(404, 'This table has no pictures.');
	if (!table.seat || table.seat.status !== 'admitted') error(403, 'You have no seat here.');
	const gmSeated = table.seats.some((s) => s.isGm && s.status === 'admitted');
	if (gmSeated && !table.seat.isGm) error(403, 'Only the GM puts up a picture.');

	// Refuse an oversized body before parsing it, rather than after.
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_BODY_CHARS) error(413, 'That picture is too large.');
	const text = await request.text();
	if (text.length > MAX_BODY_CHARS) error(413, 'That picture is too large.');

	let raw: unknown = null;
	try {
		raw = JSON.parse(text);
	} catch {
		error(400, 'Malformed picture.');
	}
	const parsed = body.safeParse(raw);
	if (!parsed.success) error(400, 'Malformed picture.');
	const checked = checkPicture(parsed.data.dataUrl);
	if (!checked.ok) {
		return json(
			{ ok: false, reason: checked.reason },
			{ status: checked.reason === 'too-large' ? 413 : 422 }
		);
	}

	const id = crypto.randomUUID();
	const tableId = table.row.id;
	await putPicture(locals.db, tableId, {
		id,
		mime: checked.mime,
		dataUrl: parsed.data.dataUrl,
		bytes: checked.bytes
	});

	// Tell the table. A lost race only means somebody else moved a card while
	// the picture was on its way; catch up and say it again, a few times.
	for (let attempt = 0; attempt < 4; attempt++) {
		const result = await runCommand(
			locals.db,
			table,
			{ type: 'set-scene-picture', id, mime: checked.mime },
			table.row.version,
			`picture:${id}`
		);
		if (result.ok) {
			return json({
				ok: true,
				...(await viewFor(
					locals.db,
					{ ...table, row: result.table, state: result.state ?? table.state },
					table.row.version
				))
			});
		}
		if (result.reason !== 'conflict') break;
		const fresh = await load();
		if (!fresh) break;
		table = fresh;
	}

	// The table never took it: keep whatever picture it does name, and no other.
	await keepOnlyPicture(locals.db, tableId, table.module.pictureOf?.(table.state) ?? null);
	return json({ ok: false, reason: 'conflict' }, { status: 409 });
};

export const GET: RequestHandler = async ({ locals, params, url, fetch }) => {
	const session = await locals.auth();
	const table = await loadTable(
		locals.db,
		fetch,
		params.token,
		locals.seatClaims[params.token],
		session?.user?.id
	);
	if (!table) error(404, 'No such table.');
	const id = url.searchParams.get('id') ?? '';
	const picture = id ? await getPicture(locals.db, table.row.id, id) : undefined;
	if (!picture) error(404, 'No such picture.');
	return new Response(picture.dataUrl, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'x-content-type-options': 'nosniff',
			// Gone from the server means gone: nothing keeps a copy on the way.
			'cache-control': 'no-store'
		}
	});
};
