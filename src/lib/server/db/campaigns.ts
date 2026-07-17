/**
 * Campaign persistence service — the shell's create/join/membership layer over
 * the `campaigns` and `campaign_members` tables (phase 9). Like the entity
 * service it takes the drizzle `db` as its first argument so tests can drive it
 * against an in-memory database, and it never reads game data: a campaign is a
 * game-tagged table a group gathers around, nothing more.
 *
 * Access control lives here, in the WHERE clauses and the membership lookups,
 * not in the routes: a caller proves who they are (a `userId` from the session)
 * and the service decides what that seat may see or change. The invite token is
 * the one capability that works without a prior seat — presenting it is how a
 * newcomer joins (commit 60).
 *
 * Server-only.
 */

import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from './entities.ts';
import {
	campaigns,
	campaignMembers,
	users,
	type Campaign,
	type CampaignMember,
	type CampaignRole
} from './schema.ts';

/** Fields a caller supplies when creating a campaign. */
export interface NewCampaignInput {
	gameId: string;
	name: string;
	ownerId: string;
}

/** A campaign row plus the viewing user's role in it — what listings need. */
export type CampaignWithRole = Campaign & { role: CampaignRole };

/**
 * Create a campaign and seat its owner as the GM. Two writes rather than one
 * transaction, matching the rest of the service (the codebase avoids explicit
 * transactions so the same code runs on better-sqlite3 and D1); the owner seat
 * failing after the campaign insert is a practical non-event (same connection,
 * same tick), and a campaign with no GM seat is still harmless — the owner can
 * always be re-seated from `ownerId`.
 */
export async function createCampaign(db: Db, input: NewCampaignInput): Promise<Campaign> {
	const [campaign] = await db
		.insert(campaigns)
		.values({ gameId: input.gameId, name: input.name, ownerId: input.ownerId })
		.returning();
	await db
		.insert(campaignMembers)
		.values({ campaignId: campaign.id, userId: input.ownerId, role: 'gm' });
	return campaign;
}

/** Load a campaign by id, or `undefined`. */
export async function getCampaign(db: Db, id: string): Promise<Campaign | undefined> {
	const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
	return row;
}

/** Load a campaign by its invite token (the join capability), or `undefined`. */
export async function getCampaignByToken(db: Db, token: string): Promise<Campaign | undefined> {
	const t = token.trim();
	if (!t) return undefined;
	const [row] = await db.select().from(campaigns).where(eq(campaigns.inviteToken, t)).limit(1);
	return row;
}

/** The viewer's membership row in a campaign, or `undefined` if they're not a member. */
export async function membershipOf(
	db: Db,
	campaignId: string,
	userId: string
): Promise<CampaignMember | undefined> {
	const [row] = await db
		.select()
		.from(campaignMembers)
		.where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
		.limit(1);
	return row;
}

/** Every campaign the user has a seat in, newest-touched first, with their role. */
export async function listCampaignsForUser(db: Db, userId: string): Promise<CampaignWithRole[]> {
	const rows = await db
		.select({ campaign: campaigns, role: campaignMembers.role })
		.from(campaignMembers)
		.innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
		.where(eq(campaignMembers.userId, userId))
		.orderBy(desc(campaigns.updatedAt));
	return rows.map((r) => ({ ...r.campaign, role: r.role }));
}

/** A seat at the table, with just enough of the user for a roster. */
export interface CampaignMemberView {
	userId: string;
	name: string | null;
	email: string;
	role: CampaignRole;
	/** Whether this member holds the delegated steading-edit grant (phase 16). */
	steadingEditor: boolean;
	joinedAt: Date;
}

/**
 * The campaign's roster — every member with their display name, ordered GM-first
 * then by join time. Not user-scoped: the caller must have confirmed the viewer
 * is a member before showing this.
 */
export async function listCampaignMembers(
	db: Db,
	campaignId: string
): Promise<CampaignMemberView[]> {
	return (
		db
			.select({
				userId: users.id,
				name: users.name,
				email: users.email,
				role: campaignMembers.role,
				steadingEditor: campaignMembers.steadingEditor,
				joinedAt: campaignMembers.joinedAt
			})
			.from(campaignMembers)
			.innerJoin(users, eq(users.id, campaignMembers.userId))
			.where(eq(campaignMembers.campaignId, campaignId))
			// `gm` sorts before `player`, so ascending role puts the GM first.
			.orderBy(asc(campaignMembers.role), asc(campaignMembers.joinedAt))
	);
}

/**
 * Whether the user runs (is GM of) at least one campaign for a given game.
 * This was the reference GM gate (commit 62) until commit 97 replaced it with
 * a reader opt-in preference (`showSetting`) on the canonical `[game=game]`
 * reference routes. Still used by the legacy `/g/[game]/reference` redirect
 * tree (sandbox can't `rm` it — see repo CLAUDE.md); drop this once that tree
 * is deleted for real. A single-row existence check — the answer is a
 * boolean, not a list.
 */
export async function isGmOfAnyCampaign(db: Db, userId: string, gameId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: campaigns.id })
		.from(campaignMembers)
		.innerJoin(campaigns, eq(campaigns.id, campaignMembers.campaignId))
		.where(
			and(
				eq(campaignMembers.userId, userId),
				eq(campaignMembers.role, 'gm'),
				eq(campaigns.gameId, gameId)
			)
		)
		.limit(1);
	return row != null;
}

/** Outcome of presenting an invite token. */
export interface JoinResult {
	campaign: Campaign;
	/** The viewer's role after joining — `player` for a newcomer, or their existing role. */
	role: CampaignRole;
	/** True only when this call created the seat (false if they were already in). */
	joined: boolean;
}

/**
 * Join a campaign by presenting its invite token. Idempotent: an existing member
 * (including the GM opening their own link) is returned as-is rather than
 * demoted or duplicated. Returns `undefined` for an unknown/empty token, so the
 * route can 404 without confirming which tokens exist.
 */
export async function joinCampaign(
	db: Db,
	token: string,
	userId: string
): Promise<JoinResult | undefined> {
	const campaign = await getCampaignByToken(db, token);
	if (!campaign) return undefined;

	const existing = await membershipOf(db, campaign.id, userId);
	if (existing) return { campaign, role: existing.role, joined: false };

	await db.insert(campaignMembers).values({ campaignId: campaign.id, userId, role: 'player' });
	return { campaign, role: 'player', joined: true };
}

/**
 * Rotate a campaign's invite token, invalidating any outstanding link. Guarded
 * to the owner: returns the updated campaign, or `undefined` if the caller
 * doesn't own it (missing or not theirs — the route maps that to 404).
 */
export async function rotateInviteToken(
	db: Db,
	campaignId: string,
	ownerId: string
): Promise<Campaign | undefined> {
	const [row] = await db
		.update(campaigns)
		.set({ inviteToken: crypto.randomUUID(), updatedAt: new Date() })
		.where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)))
		.returning();
	return row;
}

/**
 * Grant or revoke a member's steading-edit right (phase 16). GM-gated, same
 * shape as every other campaign write: the caller must be seated as this
 * campaign's GM. Returns the updated membership row, or `undefined` when the
 * caller isn't the GM, or when the target isn't a member of this campaign.
 *
 * The GM's own row isn't special-cased — a GM can always edit the steading
 * regardless of this flag — but setting it on any seat is harmless, and the
 * dashboard only offers the toggle for players.
 */
export async function setSteadingEditor(
	db: Db,
	campaignId: string,
	gmUserId: string,
	memberUserId: string,
	canEdit: boolean
): Promise<CampaignMember | undefined> {
	const seat = await membershipOf(db, campaignId, gmUserId);
	if (seat?.role !== 'gm') return undefined;

	const [row] = await db
		.update(campaignMembers)
		.set({ steadingEditor: canEdit })
		.where(
			and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, memberUserId))
		)
		.returning();
	return row;
}

/**
 * A campaign's `settings` blob, loosely typed — the shell stores whatever a
 * game's `campaignSettingsFields` put there and never interprets a key itself
 * (commit 105). `undefined`/malformed reads as `{}` rather than throwing: a
 * settings blob is a convenience, not load-bearing data.
 */
export type CampaignSettings = Record<string, boolean>;

/** Read a campaign's settings blob, or `{}` for an unknown campaign. */
export async function getCampaignSettings(db: Db, campaignId: string): Promise<CampaignSettings> {
	const campaign = await getCampaign(db, campaignId);
	const settings = campaign?.settings;
	return settings && typeof settings === 'object' ? (settings as CampaignSettings) : {};
}

/**
 * Merge a patch into a campaign's settings blob. GM-gated, same shape as
 * every other campaign write: returns the updated campaign, or `undefined` if
 * the caller isn't seated as this campaign's GM.
 */
export async function updateCampaignSettings(
	db: Db,
	campaignId: string,
	gmUserId: string,
	patch: CampaignSettings
): Promise<Campaign | undefined> {
	const seat = await membershipOf(db, campaignId, gmUserId);
	if (seat?.role !== 'gm') return undefined;

	const current = await getCampaignSettings(db, campaignId);
	const [row] = await db
		.update(campaigns)
		.set({ settings: { ...current, ...patch }, updatedAt: new Date() })
		.where(eq(campaigns.id, campaignId))
		.returning();
	return row;
}
