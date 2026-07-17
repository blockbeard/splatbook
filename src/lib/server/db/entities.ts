/**
 * Entity persistence service — the shell's save/load layer over the generic
 * blob model. Every function is scoped by `userId`, so a caller can never read
 * or mutate another account's entities: ownership is enforced in the WHERE
 * clause, not assumed by the route.
 *
 * The service takes the drizzle `db` as its first argument so tests can drive it
 * against an in-memory database; the API endpoints pass the app connection. It
 * never parses `data` — the owning game module owns that shape (`entityMeta`
 * supplies name/entityType/schemaVersion from the wizard side).
 *
 * Server-only. The dashboard's mutations (archive/delete/duplicate, commit 33)
 * reuse these same functions.
 */

import { and, desc, eq, ne } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { campaignMembers, entities, type Entity, type EntityStatus } from './schema.ts';
import * as schema from './schema.ts';

/**
 * Any drizzle SQLite connection over our schema. Deliberately the *base* type
 * rather than a driver's: the same services now run on better-sqlite3 (node and
 * atlas, synchronous) and on D1 (Cloudflare, asynchronous). Every call site
 * already awaits its queries, which both drivers satisfy.
 */
export type Db = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>;

/** Fields a caller supplies when creating a saved entity. */
export interface NewEntityInput {
	userId: string;
	gameId: string;
	entityType: string;
	name: string;
	data: unknown;
	schemaVersion: number;
	status?: EntityStatus;
}

/** Fields that may be changed on an existing entity. */
export interface EntityPatch {
	name?: string;
	data?: unknown;
	schemaVersion?: number;
	status?: EntityStatus;
}

/** Insert a new entity owned by `input.userId`. */
export async function createEntity(db: Db, input: NewEntityInput): Promise<Entity> {
	const [row] = await db
		.insert(entities)
		.values({
			userId: input.userId,
			gameId: input.gameId,
			entityType: input.entityType,
			name: input.name,
			data: input.data,
			schemaVersion: input.schemaVersion,
			status: input.status ?? 'draft'
		})
		.returning();
	return row;
}

/**
 * Update an owned entity in place, bumping `updatedAt`. Returns the new row, or
 * `undefined` if no entity with that id belongs to the user (missing or not
 * theirs — the caller maps that to 404).
 */
export async function updateEntity(
	db: Db,
	id: string,
	userId: string,
	patch: EntityPatch
): Promise<Entity | undefined> {
	const [row] = await db
		.update(entities)
		.set({ ...patch, updatedAt: new Date() })
		.where(and(eq(entities.id, id), eq(entities.userId, userId)))
		.returning();
	return row;
}

/** Load one owned entity, or `undefined`. */
export async function getEntity(db: Db, id: string, userId: string): Promise<Entity | undefined> {
	const [row] = await db
		.select()
		.from(entities)
		.where(and(eq(entities.id, id), eq(entities.userId, userId)))
		.limit(1);
	return row;
}

/** Options for narrowing a listing. */
export interface ListOptions {
	gameId?: string;
	entityType?: string;
	/** Archived entities are hidden unless this is set. */
	includeArchived?: boolean;
}

/** List a user's entities, newest-touched first. */
export async function listEntities(
	db: Db,
	userId: string,
	opts: ListOptions = {}
): Promise<Entity[]> {
	const conds = [eq(entities.userId, userId)];
	if (opts.gameId) conds.push(eq(entities.gameId, opts.gameId));
	if (opts.entityType) conds.push(eq(entities.entityType, opts.entityType));
	if (!opts.includeArchived) conds.push(ne(entities.status, 'archived'));
	return db
		.select()
		.from(entities)
		.where(and(...conds))
		.orderBy(desc(entities.updatedAt));
}

/** Set an owned entity's lifecycle status (archive/unarchive, mark ready). */
export async function setEntityStatus(
	db: Db,
	id: string,
	userId: string,
	status: EntityStatus
): Promise<Entity | undefined> {
	return updateEntity(db, id, userId, { status });
}

/** Delete an owned entity. Returns whether a row was actually removed. */
export async function deleteEntity(db: Db, id: string, userId: string): Promise<boolean> {
	const removed = await db
		.delete(entities)
		.where(and(eq(entities.id, id), eq(entities.userId, userId)))
		.returning({ id: entities.id });
	return removed.length > 0;
}

/**
 * Attach an owned entity to a campaign (or detach with `campaignId = null`).
 * Owner-scoped, so a caller can only move their own entity; a character belongs
 * to at most one campaign, so this replaces any previous attachment. The caller
 * is responsible for having verified campaign membership and a matching `gameId`
 * first — this is the low-level write, not the policy. Returns the updated row,
 * or `undefined` if the entity isn't the user's.
 */
export async function setEntityCampaign(
	db: Db,
	id: string,
	userId: string,
	campaignId: string | null
): Promise<Entity | undefined> {
	const [row] = await db
		.update(entities)
		.set({ campaignId, updatedAt: new Date() })
		.where(and(eq(entities.id, id), eq(entities.userId, userId)))
		.returning();
	return row;
}

/**
 * Every entity attached to a campaign, across all members — the party view's
 * source (commit 61). NOT user-scoped: the caller must have already confirmed
 * the viewer is a member of `campaignId`. Optionally narrowed to one entity type.
 */
export async function listCampaignEntities(
	db: Db,
	campaignId: string,
	entityType?: string
): Promise<Entity[]> {
	const conds = [eq(entities.campaignId, campaignId)];
	if (entityType) conds.push(eq(entities.entityType, entityType));
	return db
		.select()
		.from(entities)
		.where(and(...conds))
		.orderBy(desc(entities.updatedAt));
}

/**
 * Duplicate an owned entity into a fresh draft ("… (copy)"). Returns the new
 * row, or `undefined` if the source isn't the user's.
 */
export async function duplicateEntity(
	db: Db,
	id: string,
	userId: string
): Promise<Entity | undefined> {
	const source = await getEntity(db, id, userId);
	if (!source) return undefined;
	return createEntity(db, {
		userId,
		gameId: source.gameId,
		entityType: source.entityType,
		name: `${source.name} (copy)`,
		data: source.data,
		schemaVersion: source.schemaVersion,
		status: 'draft'
	});
}

/**
 * Write an entity's data blob on behalf of a campaign's GM.
 *
 * The only path by which someone writes an entity they don't own, and it exists
 * for one reason: at the end of a session the GM awards XP to the whole party,
 * and the party's characters belong to the players. So the guard is narrow — the
 * entity must be attached to a campaign the caller is seated at **as GM**.
 * Ownership is otherwise untouched: the player still owns their character, and a
 * character that isn't attached to the campaign can't be touched at all.
 *
 * The blob itself is opaque here, as everywhere: the *game* computed it in the
 * browser (it owns the rules); the shell only persists what it was handed.
 * Returns `undefined` when the caller isn't the GM of the entity's campaign.
 */
export async function updateCampaignEntityData(
	db: Db,
	id: string,
	gmUserId: string,
	data: unknown
): Promise<Entity | undefined> {
	const [row] = await db
		.select({ campaignId: entities.campaignId })
		.from(entities)
		.where(eq(entities.id, id))
		.limit(1);
	if (!row?.campaignId) return undefined;

	const [seat] = await db
		.select({ role: campaignMembers.role })
		.from(campaignMembers)
		.where(
			and(eq(campaignMembers.campaignId, row.campaignId), eq(campaignMembers.userId, gmUserId))
		)
		.limit(1);
	if (seat?.role !== 'gm') return undefined;

	const [updated] = await db
		.update(entities)
		.set({ data, updatedAt: new Date() })
		.where(eq(entities.id, id))
		.returning();
	return updated;
}

/**
 * Load a campaign steading an editor-delegate may open (phase 16).
 *
 * The campaign steading is owned by the GM who created it, but the GM can grant
 * a player edit rights on it (the `steadingEditor` flag on their seat). This is
 * the read that honours the grant, so a delegate's tracker can load a steading
 * they don't own: the entity must be a `steading` attached to a campaign where
 * the caller is seated as GM or holds the flag. Returns the entity when allowed,
 * else `undefined` (unknown entity, not a steading, unattached, or no grant).
 *
 * Scoped like every other cross-owner read: the permission lives in the seat
 * lookup here, not in the route. Narrow on purpose — it only ever reaches the
 * one entity a campaign shares, never a member's private steadings.
 */
export async function getCampaignSteadingForEditor(
	db: Db,
	id: string,
	userId: string
): Promise<Entity | undefined> {
	const [entity] = await db.select().from(entities).where(eq(entities.id, id)).limit(1);
	if (!entity || entity.entityType !== 'steading' || !entity.campaignId) return undefined;

	const [seat] = await db
		.select({ role: campaignMembers.role, steadingEditor: campaignMembers.steadingEditor })
		.from(campaignMembers)
		.where(
			and(eq(campaignMembers.campaignId, entity.campaignId), eq(campaignMembers.userId, userId))
		)
		.limit(1);
	// A GM always may; a player only with the delegated grant.
	if (!seat || (seat.role !== 'gm' && !seat.steadingEditor)) return undefined;
	return entity;
}

/**
 * Write a campaign steading's data blob on behalf of a delegated editor
 * (phase 16) — the sibling write to {@link getCampaignSteadingForEditor}, and
 * the second cross-owner write path after `updateCampaignEntityData`. The same
 * gate applies (a `steading` attached to a campaign where the caller is GM or a
 * flagged editor); the blob is opaque here, as everywhere. Returns `undefined`
 * when the caller may not edit this steading, so the route maps that to 404.
 */
export async function updateCampaignSteadingData(
	db: Db,
	id: string,
	userId: string,
	data: unknown
): Promise<Entity | undefined> {
	const editable = await getCampaignSteadingForEditor(db, id, userId);
	if (!editable) return undefined;

	const [updated] = await db
		.update(entities)
		.set({ data, updatedAt: new Date() })
		.where(eq(entities.id, id))
		.returning();
	return updated;
}
