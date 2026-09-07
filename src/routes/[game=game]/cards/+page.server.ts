/**
 * Your card tables: the ones you started (phase 29).
 *
 * Creating needs an account and nothing else does — that single rule is the
 * whole abuse story for this feature, because it removes the only unbounded
 * anonymous write. Players arrive by link and never see this page.
 */

import { error, fail, redirect } from '@sveltejs/kit';
import { getGame } from '$lib/games';
import {
	createCardTable,
	deleteCardTable,
	listCardTablesForOwner
} from '$lib/server/db/card-tables';
import { claimGmSeat, requestSeat } from '$lib/server/db/card-table-seats';
import { cardTableOf, loadPack } from '$lib/server/card-tables/service';
import { MAX_TABLES_PER_OWNER } from '$lib/card-table-limits';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const game = getGame(params.game);
	if (!game?.cardTable) error(404, 'This game has no card table.');

	const session = await locals.auth();
	if (!session?.user?.id)
		return { gameId: game.id, gameName: game.name, signedIn: false, tables: [] };

	const tables = await listCardTablesForOwner(locals.db, session.user.id);
	return {
		gameId: game.id,
		gameName: game.name,
		signedIn: true,
		tables: tables
			.filter((t) => t.gameId === game.id)
			.map((t) => ({
				id: t.id,
				name: t.name,
				token: t.roomToken,
				lastActiveAt: t.lastActiveAt.getTime()
			}))
	};
};

export const actions: Actions = {
	create: async ({ locals, params, request, fetch }) => {
		const session = await locals.auth();
		if (!session?.user?.id) error(401, 'Sign in to start a table.');

		const module = cardTableOf(params.game);
		if (!module) error(404, 'This game has no card table.');

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'Give the table a name.' });

		const opening = module.create(await loadPack(fetch, params.game, module.packFiles));
		const created = await createCardTable(locals.db, {
			gameId: params.game,
			name,
			ownerId: session.user.id,
			state: opening.state,
			stateVersion: opening.stateVersion
		});
		if (!created.ok) {
			return fail(400, {
				message: `You have ${MAX_TABLES_PER_OWNER} tables already. Delete one to start another.`
			});
		}
		// Seat the creator as GM straight away. Making somebody who has just
		// started a table fill in a join form and wait for a GM's approval — when
		// they *are* the GM — is a door that opens onto another door.
		//
		// They need no ticket: signed in, the seat is found by their account,
		// which is also how they keep it across devices.
		const seat = await requestSeat(
			locals.db,
			created.table.id,
			session.user.name?.trim() || 'The GM',
			session.user.id
		);
		if (seat.ok) await claimGmSeat(locals.db, created.table.id, seat.ticket.seat.id);

		redirect(303, `/${params.game}/cards/${created.table.roomToken}`);
	},

	delete: async ({ locals, request }) => {
		const session = await locals.auth();
		if (!session?.user?.id) error(401, 'Sign in first.');
		const form = await request.formData();
		await deleteCardTable(locals.db, String(form.get('id') ?? ''), session.user.id);
		return { ok: true };
	}
};
