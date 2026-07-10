/**
 * Database schema — the shell's persistence layer.
 *
 * Two ideas live here and nothing game-specific does:
 *
 * 1. `users` — an account. Columns match what the Auth.js Drizzle adapter
 *    expects (phase 4 commit 31 wires the adapter to this exact table), so the
 *    dev-login provider and later Google/Discord all land in one place.
 * 2. `entities` — the one genuinely universal persistence model (see
 *    `docs/architecture.md`): a saved character or steading is a single JSON
 *    blob per row tagged with `gameId` / `entityType` / `schemaVersion`. The
 *    shell never parses `data`; the owning game module does, and migrates its
 *    own blobs when it bumps `schemaVersion`. This is what lets a new game add
 *    persistence without touching a table.
 *
 * Server-only module. Tables use drizzle-orm/sqlite-core (better-sqlite3 on
 * atlas, D1 in production once the phase-8 adapter switch lands — the D1 driver
 * reads the same schema).
 */

import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/** A user account. Column shape follows the Auth.js Drizzle adapter defaults. */
export const users = sqliteTable('users', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	email: text('email').notNull(),
	emailVerified: integer('email_verified', { mode: 'timestamp_ms' }),
	image: text('image')
});

/**
 * Lifecycle of a saved entity:
 * - `draft`    — a half-built character the wizard autosaved to the DB.
 * - `ready`    — finished; shows on the dashboard as a completed sheet.
 * - `archived` — hidden from the default dashboard view but not deleted.
 */
export const ENTITY_STATUSES = ['draft', 'ready', 'archived'] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

/** A saved character/steading/etc — one opaque JSON blob per row. */
export const entities = sqliteTable(
	'entities',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** Owner. A user's entities cascade-delete with the account. */
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** Which game module owns and can parse `data` (e.g. `stonetop`). */
		gameId: text('game_id').notNull(),
		/** What kind of thing this is within the game (`character`, `steading`, …). */
		entityType: text('entity_type').notNull(),
		/** Display name for lists; the shell reads this, never `data`. */
		name: text('name').notNull().default(''),
		/** The game module's own serialized shape. Opaque to the shell. */
		data: text('data', { mode: 'json' }).notNull(),
		/** The game module's schema version for `data`; it migrates on bump. */
		schemaVersion: integer('schema_version').notNull().default(1),
		/** Lifecycle state — see ENTITY_STATUSES. */
		status: text('status', { enum: ENTITY_STATUSES }).notNull().default('draft'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [
		// The dashboard always scopes by owner, usually narrowing to one game.
		index('entities_user_idx').on(t.userId),
		index('entities_user_game_type_idx').on(t.userId, t.gameId, t.entityType)
	]
);

/** Row types inferred from the tables, for the save/load service (commit 32). */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
