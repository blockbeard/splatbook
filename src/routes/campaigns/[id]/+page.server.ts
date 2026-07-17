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
import {
	getCampaign,
	getCampaignSettings,
	membershipOf,
	rotateInviteToken,
	listCampaignMembers,
	updateCampaignSettings,
	setSteadingEditor
} from '$lib/server/db/campaigns';
import {
	getEntity,
	createEntity,
	listEntities,
	listCampaignEntities,
	setEntityCampaign
} from '$lib/server/db/entities';
import { listCampaignRolls, toLogEntry } from '$lib/server/db/rolls';
import { listCampaignSessions, updateCampaignSessionNotes } from '$lib/server/db/campaign-sessions';
import { getGame } from '$lib/games';
import type { Actions, PageServerLoad } from './$types';

/** The path a newcomer follows to join (made absolute in the browser). */
const joinPath = (token: string) => `/campaigns/join/${token}`;

/** Load a member's session + campaign seat, or fail closed. Shared by load + actions. */
async function requireSeat(id: string, locals: App.Locals) {
	const session = await locals.auth();
	if (!session?.user?.id) redirect(303, resolve('/campaigns'));
	const campaign = await getCampaign(locals.db, id);
	if (!campaign) error(404, 'No such campaign.');
	const seat = await membershipOf(locals.db, campaign.id, session.user.id);
	if (!seat) error(404, 'No such campaign.');
	return { userId: session.user.id, campaign, seat };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { userId, campaign, seat } = await requireSeat(params.id, locals);
	const isGm = seat.role === 'gm';

	// The viewer's own characters for this game, with their attachment state, so
	// they can attach one to (or detach it from) this campaign.
	const mine = await listEntities(locals.db, userId, {
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
	const [members, partyChars, steadings, rolls, sessions] = await Promise.all([
		listCampaignMembers(locals.db, campaign.id),
		listCampaignEntities(locals.db, campaign.id, 'character'),
		listCampaignEntities(locals.db, campaign.id, 'steading'),
		listCampaignRolls(locals.db, campaign.id),
		listCampaignSessions(locals.db, campaign.id)
	]);
	const party = members.map((m) => ({
		userId: m.userId,
		name: m.name ?? m.email,
		role: m.role,
		isYou: m.userId === userId,
		// Whether this member holds the delegated steading-edit grant — the GM
		// reads it to render (and flip) the per-player toggle (phase 16).
		steadingEditor: m.steadingEditor,
		characters: partyChars
			.filter((c) => c.userId === m.userId)
			.map((c) => ({ id: c.id, name: c.name || 'Unnamed character', mine: c.userId === userId }))
	}));
	const steading = steadings[0]
		? { id: steadings[0].id, name: steadings[0].name || 'Unnamed steading' }
		: null;

	const game = getGame(campaign.gameId);
	// Settings are GM-only to see or change — a player has no use for a toggle
	// they can't flip, and the field descriptions are written for the GM.
	const settings = isGm ? await getCampaignSettings(locals.db, campaign.id) : null;

	return {
		campaign: {
			id: campaign.id,
			name: campaign.name,
			gameId: campaign.gameId,
			gameName: game?.name ?? campaign.gameId
		},
		role: seat.role,
		isGm,
		myCharacters,
		party,
		steading,
		// Seed the live roll log; the client polls the same endpoint to keep it fresh.
		rolls: rolls.map(toLogEntry),
		// The session ledger (phase 17), newest first — every member sees the
		// history; only the GM may edit a record's notes. The awards are the
		// shell's own shape; `triggers` stays server-side (the game's shape, and
		// nothing here renders it). Private notes are stripped here, not hidden
		// in the UI — a player's browser never receives them.
		sessions: sessions.map((s) => ({
			id: s.id,
			number: s.number,
			date: s.date.getTime(),
			awards: s.awards,
			notes: s.notes,
			privateNotes: isGm ? s.privateNotes : null
		})),
		// The invite capability is GM-only; players never receive the token.
		invite: isGm ? { path: joinPath(campaign.inviteToken) } : null,
		// Whether this game has an end-of-session move for the GM to run.
		hasSessionMove: !!game?.sessionComponent,
		// Whether this game has an Arcana-authoring tool for the GM to run (commit 105).
		hasArcanaGm: !!game?.arcanaGmComponent,
		// This game's GM-editable settings fields, and the campaign's current
		// values for them — `null` for a player, who never sees this section.
		settingsFields: isGm ? (game?.campaignSettingsFields ?? []) : [],
		settings
	};
};

export const actions: Actions = {
	rotate: async ({ params, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) error(401, 'Sign in.');
		const rotated = await rotateInviteToken(locals.db, params.id, session.user.id);
		if (!rotated) error(403, 'Only the campaign owner can rotate the invite.');
		return { rotated: { path: joinPath(rotated.inviteToken) } };
	},

	attach: async ({ params, request, locals }) => {
		const { userId, campaign } = await requireSeat(params.id, locals);
		const entityId = String((await request.formData()).get('entityId') ?? '');
		const entity = await getEntity(locals.db, entityId, userId);
		// Own it, and it must belong to this campaign's game.
		if (!entity || entity.gameId !== campaign.gameId) {
			error(400, 'That character can’t be attached to this campaign.');
		}
		await setEntityCampaign(locals.db, entityId, userId, campaign.id);
		return { attach: { ok: true } };
	},

	detach: async ({ params, request, locals }) => {
		const { userId } = await requireSeat(params.id, locals);
		const entityId = String((await request.formData()).get('entityId') ?? '');
		await setEntityCampaign(locals.db, entityId, userId, null);
		return { detach: { ok: true } };
	},

	createSteading: async ({ params, locals }) => {
		const { userId, campaign, seat } = await requireSeat(params.id, locals);
		if (seat.role !== 'gm') error(403, 'Only the GM can create the campaign steading.');

		// One steading per campaign — if one already exists, just go to it.
		const existing = await listCampaignEntities(locals.db, campaign.id, 'steading');
		if (existing.length === 0) {
			// The shell stays game-agnostic: the game module supplies the initial
			// steading blob (`newDraft`) and its display meta (`entityMeta`).
			const type = getGame(campaign.gameId)?.entityTypes['steading'];
			if (!type?.newDraft || !type.entityMeta) {
				error(400, 'This game has no steading to create.');
			}
			const draft = type.newDraft();
			const meta = type.entityMeta(draft);
			const created = await createEntity(locals.db, {
				userId,
				gameId: campaign.gameId,
				entityType: 'steading',
				name: meta.name,
				data: draft,
				schemaVersion: meta.schemaVersion,
				status: 'ready'
			});
			await setEntityCampaign(locals.db, created.id, userId, campaign.id);
		}
		redirect(303, resolve('/campaigns/[id]/steading', { id: campaign.id }));
	},

	updateSettings: async ({ params, request, locals }) => {
		const { userId, seat } = await requireSeat(params.id, locals);
		if (seat.role !== 'gm') error(403, 'Only the GM can change campaign settings.');

		// Checkboxes only submit when checked, so presence (not value) is what a
		// boolean field means here — same convention as any HTML checkbox form.
		const form = await request.formData();
		const game = getGame((await getCampaign(locals.db, params.id))?.gameId ?? '');
		const patch = Object.fromEntries(
			(game?.campaignSettingsFields ?? []).map((f) => [f.key, form.has(f.key)])
		);

		const updated = await updateCampaignSettings(locals.db, params.id, userId, patch);
		if (!updated) error(403, 'Only the GM can change campaign settings.');
		return { settings: { ok: true } };
	},

	setSteadingEditor: async ({ params, request, locals }) => {
		const { userId, seat } = await requireSeat(params.id, locals);
		if (seat.role !== 'gm') error(403, 'Only the GM can delegate steading edits.');

		// The row carries the *desired* new state in a hidden field (the checkbox
		// itself has no name), so one form both grants and revokes.
		const form = await request.formData();
		const memberUserId = String(form.get('memberUserId') ?? '');
		const canEdit = form.get('canEdit') === 'true';
		const updated = await setSteadingEditor(locals.db, params.id, userId, memberUserId, canEdit);
		if (!updated) error(400, 'No such member to delegate to.');
		return { steadingEditor: { ok: true } };
	},

	/** Fix a recorded session's notes after the fact (commit 112) — both the
	 * shared and the private field. GM-only; the service re-checks the seat
	 * against the session's own campaign. */
	updateSessionNotes: async ({ params, request, locals }) => {
		const { userId, seat } = await requireSeat(params.id, locals);
		if (seat.role !== 'gm') error(403, 'Only the GM can edit the session log.');

		const form = await request.formData();
		const sessionId = String(form.get('sessionId') ?? '');
		const updated = await updateCampaignSessionNotes(locals.db, sessionId, userId, {
			notes: String(form.get('notes') ?? ''),
			privateNotes: String(form.get('privateNotes') ?? '')
		});
		if (!updated) error(400, 'No such session to edit.');
		return { sessionNotes: { ok: true, id: updated.id } };
	}
};
