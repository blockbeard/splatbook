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
import { integer, sqliteTable, text, index, primaryKey } from 'drizzle-orm/sqlite-core';
import type { RollResult } from '$lib/dice';

/**
 * A user account. Column shape follows the Auth.js Drizzle adapter defaults —
 * the adapter reads columns by their drizzle *property* name (`emailVerified`),
 * so the SQL names may stay snake_case. `email` is `notNull` because the
 * adapter requires it; the dev-login provider synthesizes one.
 */
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
 * Auth.js adapter tables (accounts / sessions / verification tokens). Property
 * names must match what `@auth/drizzle-adapter` expects verbatim. Sessions and
 * verification tokens are unused under the JWT session strategy the dev-login
 * Credentials provider forces, but the tables exist so switching to database
 * sessions (or adding email sign-in) later needs no migration.
 */
export const accounts = sqliteTable(
	'accounts',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<'oauth' | 'oidc' | 'email' | 'webauthn'>().notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('provider_account_id').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state')
	},
	(t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
);

export const sessions = sqliteTable('sessions', {
	sessionToken: text('session_token').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: integer('expires', { mode: 'timestamp_ms' }).notNull()
});

export const verificationTokens = sqliteTable(
	'verification_tokens',
	{
		identifier: text('identifier').notNull(),
		token: text('token').notNull(),
		expires: integer('expires', { mode: 'timestamp_ms' }).notNull()
	},
	(t) => [primaryKey({ columns: [t.identifier, t.token] })]
);

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
		/**
		 * The campaign this entity is attached to, if any (phase 9). A character
		 * belongs to at most one campaign — a single nullable column makes that
		 * true by construction. `set null` on delete so an entity outlives its
		 * campaign (it just detaches) rather than being cascaded away.
		 */
		campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
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
		index('entities_user_game_type_idx').on(t.userId, t.gameId, t.entityType),
		// The campaign party view lists every entity attached to one campaign.
		index('entities_campaign_idx').on(t.campaignId)
	]
);

/**
 * A campaign — the shared table a GM and their players gather around (phase 9).
 * Generic shell furniture, like `entities`: campaigns belong to a game (`gameId`)
 * but the shell never reads game data. The `ownerId` is the creator (always a GM
 * member too, see `campaignMembers`); `inviteToken` is the unguessable secret in
 * the join link and can be rotated to revoke outstanding invites.
 */
export const campaigns = sqliteTable(
	'campaigns',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** Which game module this campaign is played with (e.g. `stonetop`). */
		gameId: text('game_id').notNull(),
		/** Display name for lists. */
		name: text('name').notNull().default(''),
		/** The creator; cascades so deleting the account tidies their campaigns. */
		ownerId: text('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** Secret carried in the invite link; rotate to revoke outstanding invites. */
		inviteToken: text('invite_token')
			.notNull()
			.unique()
			.$defaultFn(() => crypto.randomUUID()),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [index('campaigns_owner_idx').on(t.ownerId)]
);

/** A member's role in a campaign. `gm` runs it (edit rights, GM-only rules); `player` sits at the table. */
export const CAMPAIGN_ROLES = ['gm', 'player'] as const;
export type CampaignRole = (typeof CAMPAIGN_ROLES)[number];

/**
 * Campaign membership — a user's seat at a campaign, with a role. One row per
 * (campaign, user): the composite primary key makes a double-join impossible,
 * and both foreign keys cascade so deleting either side clears the membership.
 */
export const campaignMembers = sqliteTable(
	'campaign_members',
	{
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		role: text('role', { enum: CAMPAIGN_ROLES }).notNull(),
		joinedAt: integer('joined_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [
		primaryKey({ columns: [t.campaignId, t.userId] }),
		// "Which campaigns am I in?" — the dashboard's per-user lookup.
		index('campaign_members_user_idx').on(t.userId)
	]
);

/**
 * The roll log — every dice roll made in a campaign (phase 10). Shared table
 * history: a group at one table wants to see each other's rolls, so a roll is
 * owned by the *campaign*, not the roller. `actorId` is who rolled (cascades on
 * account deletion, like their entities); `label` is the game-supplied line
 * ("Roll +DEX", later "Defy Danger +DEX"), and `result` is the shell dice
 * engine's `RollResult` stored whole — the shell owns that shape (it produced
 * it), so unlike `entities.data` it may read it back to render the breakdown.
 */
export const rolls = sqliteTable(
	'rolls',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** The campaign whose log this roll belongs to; cascades when it's deleted. */
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		/** Who rolled; cascades so deleting the account tidies their rolls. */
		actorId: text('actor_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/**
		 * Which character rolled — the name the table knows you by, and what the log
		 * leads with. Denormalised on purpose: it's the character's name *at the
		 * moment of the roll*, so the log still reads right after a rename, and the
		 * entry survives the character being deleted. Null for a roll made with no
		 * character in play (a GM rolling loose), where the account name is all
		 * there is.
		 */
		characterName: text('character_name'),
		/** Human label for the roll — the game's words (e.g. `Roll +DEX`). */
		label: text('label').notNull(),
		/** The dice engine's `RollResult` (notation, mode, dice, modifier, total). */
		result: text('result', { mode: 'json' }).notNull().$type<RollResult>(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	// The log is always read newest-first for one campaign.
	(t) => [index('rolls_campaign_idx').on(t.campaignId, t.createdAt)]
);

/**
 * A user's saved preference — one flat namespace of `key` -> `value` string
 * pairs (phase 13). Generic on purpose, like `entities.data`: a preference's
 * *meaning* (`reference.showSetting`, and whatever follows it) belongs to
 * whichever feature reads it, not to this table. Composite primary key
 * (`userId`, `key`) makes "one row per user per key" true by construction, so
 * writing a preference is a plain upsert rather than a select-then-branch.
 * Signed-out readers get the same key/value shape in `localStorage`
 * (`$lib/preferences/client`) instead of a row here; there is nothing to
 * migrate on sign-in the way drafts are — a preference set while signed out
 * is a browser default, not a server intent, so it doesn't need to survive
 * the account existing.
 */
export const preferences = sqliteTable(
	'preferences',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		value: text('value').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [primaryKey({ columns: [t.userId, t.key] })]
);

/** Row types inferred from the tables, for the save/load service (commit 32). */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignMember = typeof campaignMembers.$inferSelect;
export type NewCampaignMember = typeof campaignMembers.$inferInsert;
export type Roll = typeof rolls.$inferSelect;
export type NewRoll = typeof rolls.$inferInsert;
export type Preference = typeof preferences.$inferSelect;
export type NewPreference = typeof preferences.$inferInsert;
