/**
 * A single campaign. Membership is the gate: only a seated member (GM or player)
 * may view it; anyone else gets a 404 (not 403 — we don't confirm the campaign
 * exists to non-members). The GM additionally sees the invite link and can
 * rotate it to revoke outstanding invites.
 *
 * The party-at-a-glance and campaign steading are added in commits 61 and 63;
 * this commit establishes the page, the access gate, and the invite plumbing.
 */

import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { db } from '$lib/server/db';
import {
	getCampaign,
	membershipOf,
	rotateInviteToken,
	listCampaignMembers
} from '$lib/server/db/campaigns';
import {
	getEntity,
	createEntity,
	listEntities,
	listCampaignEntities,
	setEntityCampaign
} from '$lib/server/db/entities';
import { getGame } from '$lib/games';
import type { Actions, PageServerLoad } from './$types';

/** The path a newcomer follows to join (made absolute in the browser). */
const joinPath = (token: string) => `/campaigns/join/${token}`;

/** Load a member's session + campaign seat, or fail closed. Shared by load + actions. */
async function requireSeat(id: string, locals: App.Locals) {
	const session = await locals.auth();
	if (!session?.user?.id) redirect(303, resolve('/campaigns'));
	const campaign = await getCampaign(db, id);
	if (!campaign) error(404, 'No such campaign.');
	const seat = await membershipOf(db, campaign.id, session.user.id);
	if (!seat) error(404, 'No such campaign.');
	return { userId: session.user.id, campaign, seat };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { userId, campaign, seat } = await requireSeat(params.id, locals);
	const isGm = seat.role === 'gm';

	// The viewer's own characters for this game, with their attachment state, so
	// they can attach one to (or detach it from) this campaign.
	const mine = await listEntities(db, userId, {
		gameId: campaign.gameId,
		entityType: 'character'
	});
	const myCharacters = mine.map((c) => ({
		id: c.id,
		name: c.name,
		attachedHere: c.campaignId === campaign.id,
		// Attached to a different campaign — a character belongs to only one.
		attachedElsewhere: c.campaignId != null && c.campaignId !== campaign.id
	}));

	// Party at a glance: every member, and the characters attached to the campaign
	// grouped under their owner. A character links to its sheet only for its owner
	// (the sheet route is owner-scoped); others show as read-only names.
	const [members, partyChars, steadings] = await Promise.all([
		listCampaignMembers(db, campaign.id),
		listCampaignEntities(db, campaign.id, 'character'),
		listCampaignEntities(db, campaign.id, 'steading')
	]);
	const party = members.map((m) => ({
		userId: m.userId,
		name: m.name ?? m.email,
		role: m.role,
		isYou: m.userId === userId,
		characters: partyChars
			.filter((c) => c.userId === m.userId)
			.map((c) => ({ id: c.id, name: c.name || 'Unnamed character', mine: c.userId === userId }))
	}));
	const steading = steadings[0]
		? { id: steadings[0].id, name: steadings[0].name || 'Unnamed steading' }
		: null;

	return {
		campaign: {
			id: campaign.id,
			name: campaign.name,
			gameId: campaign.gameId,
			gameName: getGame(campaign.gameId)?.name ?? campaign.gameId
		},
		role: seat.role,
		isGm,
		myCharacters,
		party,
		steading,
		// The invite capability is GM-only; players never receive the token.
		invite: isGm ? { path: joinPath(campaign.inviteToken) } : null
	};
};

export const actions: Actions = {
	rotate: async ({ params, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) error(401, 'Sign in.');
		const rotated = await rotateInviteToken(db, params.id, session.user.id);
		if (!rotated) error(403, 'Only the campaign owner can rotate the invite.');
		return { rotated: { path: joinPath(rotated.inviteToken) } };
	},

	attach: async ({ params, request, locals }) => {
		const { userId, campaign } = await requireSeat(params.id, locals);
		const entityId = String((await request.formData()).get('entityId') ?? '');
		const entity = await getEntity(db, entityId, userId);
		// Own it, and it must belong to this campaign's game.
		if (!entity || entity.gameId !== campaign.gameId) {
			error(400, 'That character can’t be attached to this campaign.');
		}
		await setEntityCampaign(db, entityId, userId, campaign.id);
		return { attach: { ok: true } };
	},

	detach: async ({ params, request, locals }) => {
		const { userId } = await requireSeat(params.id, locals);
		const entityId = String((await request.formData()).get('entityId') ?? '');
		await setEntityCampaign(db, entityId, userId, null);
		return { detach: { ok: true } };
	},

	createSteading: async ({ params, locals }) => {
		const { userId, campaign, seat } = await requireSeat(params.id, locals);
		if (seat.role !== 'gm') error(403, 'Only the GM can create the campaign steading.');

		// One steading per campaign — if one already exists, just go to it.
		const existing = await listCampaignEntities(db, campaign.id, 'steading');
		if (existing.length === 0) {
			// The shell stays game-agnostic: the game module supplies the initial
			// steading blob (`newDraft`) and its display meta (`entityMeta`).
			const type = getGame(campaign.gameId)?.entityTypes['steading'];
			if (!type?.newDraft || !type.entityMeta) {
				error(400, 'This game has no steading to create.');
			}
			const draft = type.newDraft();
			const meta = type.entityMeta(draft);
			const created = await createEntity(db, {
				userId,
				gameId: campaign.gameId,
				entityType: 'steading',
				name: meta.name,
				data: draft,
				schemaVersion: meta.schemaVersion,
				status: 'ready'
			});
			await setEntityCampaign(db, created.id, userId, campaign.id);
		}
		redirect(303, resolve('/campaigns/[id]/steading', { id: campaign.id }));
	}
};
