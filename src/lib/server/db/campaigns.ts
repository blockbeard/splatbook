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

import { and, desc, eq } from 'drizzle-orm';
import type { Db } from './entities.ts';
import {
	campaigns,
	campaignMembers,
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
