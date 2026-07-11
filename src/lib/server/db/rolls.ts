/**
 * Roll-log service — the shell's append-and-read layer over the `rolls` table
 * (phase 10). A campaign's rolls are shared history: everyone at the table sees
 * everyone's rolls, so the log is keyed by campaign, not by roller.
 *
 * Like the entity and campaign services it takes the drizzle `db` as its first
 * argument (so tests drive it against an in-memory database) and keeps access
 * control here rather than in the routes: `logRoll` refuses a non-member — you
 * can only add to the log of a table you sit at — while `listCampaignRolls` is
 * roster-style (the caller confirms the viewer's membership before showing it).
 *
 * The `result` blob is the dice engine's `RollResult`; unlike a game's opaque
 * entity `data`, the shell owns that shape and reads it back to render rolls.
 *
 * Server-only.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { RollResult } from '$lib/dice';
import type { RollLogEntry } from '$lib/rolls';
import type { Db } from './entities.ts';
import { campaignMembers, rolls, users, type Roll } from './schema.ts';

/** Fields a caller supplies when appending to a campaign's roll log. */
export interface NewRollInput {
	campaignId: string;
	/** The member who rolled. */
	actorId: string;
	/** The game-supplied label for the roll (e.g. `Roll +DEX`). */
	label: string;
	/** The dice engine's outcome, stored whole. */
	result: RollResult;
}

/** A logged roll plus the roller's display name — what the log renders. */
export interface RollView {
	id: string;
	actorId: string;
	actorName: string | null;
	label: string;
	result: RollResult;
	createdAt: Date;
}

/**
 * Append a roll to a campaign's log. Guarded to members: a caller who isn't
 * seated at the campaign gets `undefined` (the route maps that to 403/404)
 * rather than writing into a table they don't belong to. Returns the stored row.
 */
export async function logRoll(db: Db, input: NewRollInput): Promise<Roll | undefined> {
	const [seat] = await db
		.select({ userId: campaignMembers.userId })
		.from(campaignMembers)
		.where(
			and(
				eq(campaignMembers.campaignId, input.campaignId),
				eq(campaignMembers.userId, input.actorId)
			)
		)
		.limit(1);
	if (!seat) return undefined;

	const [row] = await db
		.insert(rolls)
		.values({
			campaignId: input.campaignId,
			actorId: input.actorId,
			label: input.label,
			result: input.result
		})
		.returning();
	return row;
}

/**
 * The campaign's roll log, newest first, each with the roller's name. Not
 * user-scoped: the caller must have confirmed the viewer is a member before
 * showing this (the campaign routes already gate on membership). `limit` caps
 * how many recent rolls to return.
 */
export async function listCampaignRolls(
	db: Db,
	campaignId: string,
	limit = 50
): Promise<RollView[]> {
	const rows = await db
		.select({
			id: rolls.id,
			actorId: rolls.actorId,
			actorName: users.name,
			label: rolls.label,
			result: rolls.result,
			createdAt: rolls.createdAt
		})
		.from(rolls)
		.innerJoin(users, eq(users.id, rolls.actorId))
		.where(eq(rolls.campaignId, campaignId))
		// Newest first; break ties on the monotonic rowid so rolls made in the
		// same millisecond still read back in insertion order (the `id` is a
		// random uuid and would order arbitrarily).
		.orderBy(desc(rolls.createdAt), sql`${rolls}.rowid desc`)
		.limit(limit);
	return rows;
}

/** Map a `RollView` to the client-facing `RollLogEntry` (used by the log GET
 * endpoint and the campaign page load, so both send the same shape). */
export function toLogEntry(r: RollView): RollLogEntry {
	return {
		id: r.id,
		actorName: r.actorName ?? 'Unknown',
		label: r.label,
		result: r.result,
		at: r.createdAt.getTime()
	};
}
