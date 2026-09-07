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
import {
	integer,
	sqliteTable,
	text,
	index,
	primaryKey,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
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
		/**
		 * Table-wide config, GM-editable (commit 105 — the first use). Opaque to
		 * the shell, same spirit as `entities.data`: the shell persists and merges
		 * it, but never interprets a key. A game registers what it wants to offer
		 * through `GameModule.campaignSettingsFields`; the shell renders those as
		 * generic checkboxes on the campaign dashboard and stores whatever the GM
		 * sets here, keyed by the field's own `key`.
		 */
		settings: text('settings', { mode: 'json' }).notNull().default('{}'),
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
		/**
		 * Whether this member may edit the campaign's shared steading (phase 16).
		 * The GM always can — the steading is theirs to run; this flag delegates
		 * that edit right to a player, letting the shared tracker be live for them
		 * rather than read-only. Enforced on the steading write path, not just the
		 * UI: the grant is honest. Defaults off — delegation is opt-in per member.
		 */
		steadingEditor: integer('steading_editor', { mode: 'boolean' }).notNull().default(false),
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
 * One award handed out when a session was recorded — the denormalised
 * per-character line the ledger renders. Like `rolls.characterName`, the name
 * is captured *at the moment of recording* and there is deliberately no foreign
 * key on `entityId`: the history should read right after a rename and survive
 * the character being deleted or detached. The shell owns this shape (its own
 * flow produced it), so unlike `entities.data` it may read it back.
 */
export interface SessionAward {
	/** The character entity at the time of recording; dangling later is fine. */
	entityId: string;
	/** The character's name when the session ended. */
	name: string;
	/** XP awarded to this character by that session's end-of-session move. */
	xp: number;
}

/**
 * The session ledger (phase 17) — one row per end-of-session run. Until now the
 * ritual marked everyone's XP and then forgot: notes lived in the GM's browser
 * and the awards evaporated into the sheets. This table is the memory.
 *
 * `number` is the campaign's own session count (1, 2, 3…), assigned by the
 * service at record time. `triggers` is the game's answer shape stored opaquely
 * (same discipline as `entities.data` — the shell never parses which questions
 * were checked, it just keeps them so the game could render them back some
 * day). `awards` is shell-owned (see {@link SessionAward}); `notes` is the
 * GM's prose, editable after the fact.
 */
export const campaignSessions = sqliteTable(
	'campaign_sessions',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** The campaign this session belongs to; history dies with the table. */
		campaignId: text('campaign_id')
			.notNull()
			.references(() => campaigns.id, { onDelete: 'cascade' }),
		/** 1-based position in this campaign's history, assigned at record time. */
		number: integer('number').notNull(),
		/** When the session was recorded (defaults to now). */
		date: integer('date', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		/** The checked end-of-session triggers — the game's own shape, opaque here. */
		triggers: text('triggers', { mode: 'json' }).notNull().default('{}'),
		/** Per-character awards, denormalised for display. */
		awards: text('awards', { mode: 'json' }).notNull().default('[]').$type<SessionAward[]>(),
		/** The GM's session notes — shared: every member reads these on the
		 * dashboard's session log, and the flow says so where they're written. */
		notes: text('notes').notNull().default(''),
		/**
		 * The GM's *private* notes (post-review addition to phase 17): spoilers,
		 * prep, suspicions the table shouldn't read. Stored on the same row but
		 * only ever loaded into a GM's view — the dashboard load strips them for
		 * players, so they never cross the wire to a player's browser.
		 */
		privateNotes: text('private_notes').notNull().default(''),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	// The log is always read as one campaign's history in session order.
	(t) => [index('campaign_sessions_campaign_idx').on(t.campaignId, t.number)]
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

/**
 * A card table (phase 29) — a live shared surface for a game that has one.
 *
 * Unlike a campaign, a table is reached by a *token in its URL* rather than by
 * membership: the room token is what you paste into chat, and holding it is how
 * you arrive at the seat list. Creating one needs an account, which is the
 * whole of the abuse story — the alternative was inventing a rate limiter this
 * codebase does not have, and on Cloudflare a per-IP counter wants KV or a
 * Durable Object (the primitive this phase deliberately declined) or a WAF rule
 * a self-hoster would never inherit. Requiring sign-in to create removes the
 * only unbounded anonymous write endpoint; everything left is bounded by the
 * seats a table can hold.
 *
 * `state` is the game's own blob, opaque here exactly as `entities.data` is.
 * `version` is the optimistic-concurrency counter the command service will
 * check against (phase 29 commit 10), and `commandCount` is the per-table
 * ceiling, kept as a column so incrementing it costs nothing extra on a write
 * that was happening anyway.
 */
export const cardTables = sqliteTable(
	'card_tables',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		/** Which game module owns the surface, e.g. `hmtw`. */
		gameId: text('game_id').notNull(),
		/** Display name for the creator's own listings. */
		name: text('name').notNull().default(''),
		/** The creator. Cascades so deleting an account tidies their tables. */
		ownerId: text('owner_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/**
		 * The secret in the URL. Rotate to revoke every outstanding link — which
		 * is the only way to shut a table nobody should still be at, since seats
		 * are not accounts.
		 */
		roomToken: text('room_token')
			.notNull()
			.unique()
			.$defaultFn(() => crypto.randomUUID()),
		/** The game's own table state. Opaque: the shell migrates nothing here. */
		state: text('state', { mode: 'json' }).notNull().default('{}'),
		/** The game's schema version for `state`, so a read can migrate it. */
		stateVersion: integer('state_version').notNull().default(0),
		/** Monotonic, bumped on every accepted command. */
		version: integer('version').notNull().default(0),
		/** How many commands this table has accepted, against its ceiling. */
		commandCount: integer('command_count').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		/**
		 * Last time anyone touched it. Retention is six weeks by lazy expiry, so
		 * this is the column that decides whether a table is still there when
		 * someone comes back to it.
		 */
		lastActiveAt: integer('last_active_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [
		index('card_tables_owner_idx').on(t.ownerId),
		index('card_tables_active_idx').on(t.lastActiveAt)
	]
);

/** What a seat is doing: waiting for the GM, or sitting at the table. */
export const SEAT_STATUSES = ['pending', 'admitted'] as const;
export type SeatStatus = (typeof SEAT_STATUSES)[number];

/**
 * A seat at a card table.
 *
 * Not a membership row: a seat may be held by somebody with no account at all,
 * which is the point — a player at 8pm on a call should not have to sign up to
 * pick up cards. `userId` is therefore nullable and `claimSecret` is what a
 * guest presents instead (phase 29 commit 8).
 *
 * The *seat* is the identity, not the browser: a player who clears their
 * cookies comes back through the GM re-seating them, and their private zones
 * are keyed to this row rather than to whatever proved it last.
 *
 * `name` is the **character's** name, and the join form says so. That keeps
 * what a table stores to a piece of fiction, a random id and a list of card
 * moves — no account, and nothing that identifies a person.
 */
export const cardTableSeats = sqliteTable(
	'card_table_seats',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tableId: text('table_id')
			.notNull()
			.references(() => cardTables.id, { onDelete: 'cascade' }),
		/** The character's name, as shown to the table. */
		name: text('name').notNull(),
		/** Set when a signed-in user holds the seat; null for a guest. */
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
		/** Hash of the capability a guest presents to prove this seat is theirs. */
		claimSecret: text('claim_secret'),
		status: text('status', { enum: SEAT_STATUSES }).notNull().default('pending'),
		/** Whether this seat is running the game. Vacatable, and then claimable. */
		isGm: integer('is_gm', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [index('card_table_seats_table_idx').on(t.tableId)]
);

/**
 * The public log of what happened at a card table (phase 29).
 *
 * **Everything in here is public.** That is the whole design, and it is what
 * makes the sync channel safe: private state — a hand, a facedown card's value —
 * travels only through the game's per-seat projection of the table, which has
 * its own leak tests. An event says "seat 3 drew four cards", never which four.
 *
 * The plan had this log carrying per-recipient secret rows alongside, mirroring
 * guild-book. Syncing projected *state* rather than replayable commands made
 * that unnecessary: a player learns their new cards because their hand is in
 * their own projection, so there is nothing private left for an event to carry,
 * and one leak surface is easier to hold correct than two.
 *
 * `version` is the table version this event produced — the same counter, so a
 * client's cursor is simply the version it already has. `requestHash` makes a
 * retried command land once: the unique index is the enforcement, not a check.
 */
export const cardTableEvents = sqliteTable(
	'card_table_events',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tableId: text('table_id')
			.notNull()
			.references(() => cardTables.id, { onDelete: 'cascade' }),
		/** The table version this event produced. Monotonic per table. */
		version: integer('version').notNull(),
		/** Which seat did it. Null for something the table did to itself. */
		actorSeatId: text('actor_seat_id').references(() => cardTableSeats.id, {
			onDelete: 'set null'
		}),
		/** Game-defined event kind, e.g. `deal`. The shell never interprets it. */
		kind: text('kind').notNull(),
		/** Game-defined, and public by contract. Opaque here. */
		data: text('data', { mode: 'json' }).notNull().default('{}'),
		/** Idempotency key: the same command retried produces one event. */
		requestHash: text('request_hash').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [
		index('card_table_events_table_idx').on(t.tableId, t.version),
		uniqueIndex('card_table_events_request_uq').on(t.tableId, t.requestHash)
	]
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
export type CampaignSession = typeof campaignSessions.$inferSelect;
export type NewCampaignSession = typeof campaignSessions.$inferInsert;
export type Preference = typeof preferences.$inferSelect;
export type NewPreference = typeof preferences.$inferInsert;
export type CardTableRow = typeof cardTables.$inferSelect;
export type NewCardTableRow = typeof cardTables.$inferInsert;
export type CardTableSeat = typeof cardTableSeats.$inferSelect;
export type NewCardTableSeat = typeof cardTableSeats.$inferInsert;
export type CardTableEvent = typeof cardTableEvents.$inferSelect;
export type NewCardTableEvent = typeof cardTableEvents.$inferInsert;
