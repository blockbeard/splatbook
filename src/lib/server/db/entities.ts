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
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { entities, type Entity, type EntityStatus } from './schema.ts';
import * as schema from './schema.ts';

/** Any drizzle SQLite connection over our schema (better-sqlite3 today, D1 later). */
export type Db = BetterSQLite3Database<typeof schema>;

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
export async function getEntity(
	db: Db,
	id: string,
	userId: string
): Promise<Entity | undefined> {
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
