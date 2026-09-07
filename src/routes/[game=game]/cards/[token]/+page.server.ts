/**
 * A card table (phase 29).
 *
 * The one page-load that writes: it marks the table as still in use and retires
 * a few nobody came back to. Both are deliberately *here* rather than on the
 * poll, which every client asks about once a second — hanging writes off that
 * path would cost more than the feature is worth.
 */

import { error, fail } from '@sveltejs/kit';
import { loadTable, touchOnPageLoad, viewFor } from '$lib/server/card-tables/service';
import { claimGmSeat, admitSeat, removeSeat, requestSeat } from '$lib/server/db/card-table-seats';
import {
	SEAT_COOKIE,
	SEAT_COOKIE_OPTIONS,
	formatSeatClaims,
	withSeatClaim
} from '$lib/seat-claims';
import { MAX_SEAT_NAME_LENGTH } from '$lib/card-table-limits';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, fetch }) => {
	const session = await locals.auth();
	const table = await loadTable(
		locals.db,
		fetch,
		params.token,
		locals.seatClaims[params.token],
		session?.user?.id
	);
	// A token naming no table and one whose table has expired give the same
	// answer, so neither reveals whether it ever existed.
	if (!table) error(404, 'No such table.');

	await touchOnPageLoad(locals.db, table.row.id);

	return {
		gameId: table.row.gameId,
		name: table.row.name,
		token: params.token,
		pack: table.pack,
		view: await viewFor(locals.db, table, 0),
		seats: table.seats.map((s) => ({
			id: s.id,
			name: s.name,
			status: s.status,
			isGm: s.isGm
		})),
		mySeat: table.seat
			? { id: table.seat.id, status: table.seat.status, isGm: table.seat.isGm }
			: null
	};
};

/** Everything a seat does to the *table's roster* rather than to its cards. */
export const actions: Actions = {
	/** Ask for a seat. The one thing somebody with no account can do. */
	join: async ({ locals, params, request, cookies, fetch }) => {
		const session = await locals.auth();
		const table = await loadTable(locals.db, fetch, params.token, undefined, session?.user?.id);
		if (!table) error(404, 'No such table.');

		const form = await request.formData();
		const name = String(form.get('name') ?? '');
		const result = await requestSeat(locals.db, table.row.id, name, session?.user?.id);
		if (!result.ok) {
			return fail(400, {
				message: {
					'table-full': 'Every seat is taken.',
					'too-many-waiting': 'Too many people are already waiting. Ask the GM.',
					'bad-name': `Give your character a name, up to ${MAX_SEAT_NAME_LENGTH} characters.`
				}[result.reason]
			});
		}

		// The ticket goes in a cookie, never the URL: people share their screen
		// mid-game, and a seat capability in the address bar is one everybody on
		// the call can read.
		cookies.set(
			SEAT_COOKIE,
			formatSeatClaims(
				withSeatClaim(locals.seatClaims, params.token, {
					seatId: result.ticket.seat.id,
					secret: result.ticket.secret
				})
			),
			SEAT_COOKIE_OPTIONS
		);
		return { ok: true };
	},

	/** Take the GM chair while it is empty. Anyone already admitted may. */
	claimGm: async ({ locals, params, fetch }) => {
		const session = await locals.auth();
		const table = await loadTable(
			locals.db,
			fetch,
			params.token,
			locals.seatClaims[params.token],
			session?.user?.id
		);
		if (!table?.seat) error(403, 'You have no seat here.');
		await claimGmSeat(locals.db, table.row.id, table.seat.id);
		return { ok: true };
	},

	admit: async ({ locals, params, request, fetch }) => {
		const session = await locals.auth();
		const table = await loadTable(
			locals.db,
			fetch,
			params.token,
			locals.seatClaims[params.token],
			session?.user?.id
		);
		if (!table?.seat) error(403, 'You have no seat here.');
		const form = await request.formData();
		await admitSeat(locals.db, table.row.id, String(form.get('seatId') ?? ''), table.seat.id);
		return { ok: true };
	},

	decline: async ({ locals, params, request, fetch }) => {
		const session = await locals.auth();
		const table = await loadTable(
			locals.db,
			fetch,
			params.token,
			locals.seatClaims[params.token],
			session?.user?.id
		);
		if (!table?.seat) error(403, 'You have no seat here.');
		const form = await request.formData();
		await removeSeat(locals.db, table.row.id, String(form.get('seatId') ?? ''), table.seat.id);
		return { ok: true };
	}
};
