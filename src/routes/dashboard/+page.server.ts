/**
 * Dashboard load — the signed-in user's saved entities, grouped by game. Reads
 * the entity service directly on the server (no internal fetch). When signed
 * out it returns `signedIn: false` so the page can prompt to sign in rather
 * than 401. `?archived=true` includes archived entities.
 */

import { listEntities } from '$lib/server/db/entities';
import { getGame } from '$lib/games';
import { groupByGame, type DashboardItem } from '$lib/entities/dashboard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return { signedIn: false, showArchived: false, groups: [] };
	}

	const showArchived = url.searchParams.get('archived') === 'true';
	const rows = await listEntities(locals.db, session.user.id, { includeArchived: showArchived });
	const items: DashboardItem[] = rows.map((r) => {
		const game = getGame(r.gameId);
		return {
			id: r.id,
			name: r.name,
			gameId: r.gameId,
			gameName: game?.name ?? r.gameId,
			entityType: r.entityType,
			typeLabel: game?.entityTypes[r.entityType]?.label ?? r.entityType,
			status: r.status,
			updatedAt: r.updatedAt.toISOString()
		};
	});

	return { signedIn: true, showArchived, groups: groupByGame(items) };
};
