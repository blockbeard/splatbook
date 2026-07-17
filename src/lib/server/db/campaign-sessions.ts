/**
 * Session-ledger service — the shell's record-and-read layer over the
 * `campaign_sessions` table (phase 17). End of session already runs GM-side and
 * marks everyone's XP; this is the part that *remembers*: one row per run, with
 * the campaign's own session number, the checked triggers (opaque — the game's
 * shape), the per-character awards (shell-owned, denormalised for display) and
 * the GM's notes.
 *
 * Like the other services it takes the drizzle `db` first (tests drive it
 * against an in-memory database) and keeps access control here, not in routes:
 * recording and editing are GM-of-this-campaign writes — the same seat that may
 * end a session is the only one that may write its history — while listing is
 * roster-style (the caller confirms membership before showing it, the same
 * contract as `listCampaignRolls`).
 *
 * Server-only.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from './entities.ts';
import {
	campaignMembers,
	campaignSessions,
	type CampaignSession,
	type SessionAward
} from './schema.ts';

/** Fields a caller supplies when recording a finished session. */
export interface NewSessionRecord {
	campaignId: string;
	/** The game's answer shape (which triggers were checked), stored opaquely. */
	triggers: unknown;
	/** Per-character awards, already denormalised (id, name-at-the-time, xp). */
	awards: SessionAward[];
	/** The GM's session notes. */
	notes: string;
}

/** The caller's GM seat at a campaign, or nothing. */
async function gmSeatOf(db: Db, campaignId: string, userId: string): Promise<boolean> {
	const [seat] = await db
		.select({ role: campaignMembers.role })
		.from(campaignMembers)
		.where(and(eq(campaignMembers.campaignId, campaignId), eq(campaignMembers.userId, userId)))
		.limit(1);
	return seat?.role === 'gm';
}

/**
 * Record one end-of-session run. GM-gated: `undefined` for anyone else (the
 * route maps that to 403). The session `number` is assigned here — one more
 * than the campaign's current count — so the caller never supplies or guesses
 * it. Two statements rather than a transaction, matching the rest of the
 * service layer (the same code must run on better-sqlite3 and D1); a duplicate
 * number would take two GMs ending the same session in the same instant, and
 * the ledger renders duplicates harmlessly (two rows, same number).
 */
export async function recordCampaignSession(
	db: Db,
	userId: string,
	input: NewSessionRecord
): Promise<CampaignSession | undefined> {
	if (!(await gmSeatOf(db, input.campaignId, userId))) return undefined;

	const [{ max }] = await db
		.select({ max: sql<number>`coalesce(max(${campaignSessions.number}), 0)` })
		.from(campaignSessions)
		.where(eq(campaignSessions.campaignId, input.campaignId));

	const [row] = await db
		.insert(campaignSessions)
		.values({
			campaignId: input.campaignId,
			number: max + 1,
			triggers: input.triggers ?? {},
			awards: input.awards,
			notes: input.notes
		})
		.returning();
	return row;
}

/**
 * A campaign's session history, newest first. Not user-scoped: the caller must
 * have confirmed the viewer is a member before showing this (the campaign
 * routes already gate on membership), same as the roll log.
 */
export async function listCampaignSessions(db: Db, campaignId: string): Promise<CampaignSession[]> {
	return db
		.select()
		.from(campaignSessions)
		.where(eq(campaignSessions.campaignId, campaignId))
		.orderBy(desc(campaignSessions.number));
}
