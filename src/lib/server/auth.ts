/**
 * Authentication — Auth.js wired to the shell.
 *
 * Defaults to a zero-config **dev-login** so local work needs no OAuth setup:
 * a Credentials provider that upserts a user row and signs you in. Google and
 * Discord switch on automatically when their client id/secret env vars are
 * present, so production just sets those (and `AUTH_DEV_LOGIN=false`).
 *
 * The Credentials provider forces the JWT session strategy (Auth.js can't issue
 * database sessions for credentials), so the user id is threaded through the
 * token → session callbacks rather than looked up per request. The Drizzle
 * adapter still persists users/accounts, so OAuth sign-ins land a real `users`
 * row that entities can foreign-key to.
 *
 * Server-only. `enabledProviderIds` and the callback helpers are pure and
 * exported for unit testing; the wiring below is exercised by e2e.
 */

import { SvelteKitAuth, type SvelteKitAuthConfig } from '@auth/sveltekit';
import Credentials from '@auth/sveltekit/providers/credentials';
import Google from '@auth/sveltekit/providers/google';
import Discord from '@auth/sveltekit/providers/discord';
import type { Provider } from '@auth/sveltekit/providers';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getDb } from './db/index.ts';
import type { Db } from './db/entities.ts';
import { users, accounts, sessions, verificationTokens } from './db/schema.ts';

/** The env vars that decide which sign-in methods are available. */
export interface AuthEnv {
	/** Set to `'false'` to disable the dev-login provider (e.g. in production). */
	AUTH_DEV_LOGIN?: string;
	AUTH_GOOGLE_ID?: string;
	AUTH_GOOGLE_SECRET?: string;
	AUTH_DISCORD_ID?: string;
	AUTH_DISCORD_SECRET?: string;
}

/**
 * Which provider ids are enabled for a given environment. Dev-login is on by
 * default (the point of a local-first tool); OAuth providers require both id
 * and secret. Pure so the gating is unit-tested without booting Auth.js.
 */
export function enabledProviderIds(e: AuthEnv): string[] {
	const ids: string[] = [];
	if (e.AUTH_DEV_LOGIN !== 'false') ids.push('dev');
	if (e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET) ids.push('google');
	if (e.AUTH_DISCORD_ID && e.AUTH_DISCORD_SECRET) ids.push('discord');
	return ids;
}

/** Copy the user id onto the JWT at sign-in so later requests carry it. */
export function applyTokenId<T extends Record<string, unknown>>(
	token: T,
	user?: { id?: string } | null
): T {
	if (user?.id) (token as Record<string, unknown>).id = user.id;
	return token;
}

/** Expose the id from the JWT on `session.user.id` for load functions. */
export function applySessionId<S extends { user?: { id?: string } }>(
	session: S,
	token: Record<string, unknown>
): S {
	if (session.user && typeof token.id === 'string') session.user.id = token.id;
	return session;
}

/**
 * The dev-login provider: accepts an optional name/email, upserts the matching
 * user row, and signs in as it. No password — it exists only where you've
 * chosen to enable it.
 */
function devLogin(db: Db): Provider {
	return Credentials({
		id: 'dev',
		name: 'Dev Login',
		credentials: {
			name: { label: 'Name', type: 'text', placeholder: 'Local Player' },
			email: { label: 'Email', type: 'text', placeholder: 'dev@localhost' }
		},
		async authorize(creds) {
			const name = String(creds?.name ?? '').trim() || 'Local Player';
			const email = (String(creds?.email ?? '').trim() || 'dev@localhost').toLowerCase();

			const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
			const user = existing[0] ?? (await db.insert(users).values({ email, name }).returning())[0];
			return { id: user.id, name: user.name ?? name, email: user.email };
		}
	});
}

/** Build the enabled providers for this environment. */
function buildProviders(e: AuthEnv, db: Db): Provider[] {
	const ids = enabledProviderIds(e);
	const providers: Provider[] = [];
	if (ids.includes('dev')) providers.push(devLogin(db));
	if (ids.includes('google')) {
		providers.push(Google({ clientId: e.AUTH_GOOGLE_ID, clientSecret: e.AUTH_GOOGLE_SECRET }));
	}
	if (ids.includes('discord')) {
		providers.push(Discord({ clientId: e.AUTH_DISCORD_ID, clientSecret: e.AUTH_DISCORD_SECRET }));
	}
	return providers;
}

// The `$env/dynamic/private` module is typed with an open index signature; pull
// out just the vars we care about into the narrow AuthEnv shape.
const authEnv: AuthEnv = {
	AUTH_DEV_LOGIN: env.AUTH_DEV_LOGIN,
	AUTH_GOOGLE_ID: env.AUTH_GOOGLE_ID,
	AUTH_GOOGLE_SECRET: env.AUTH_GOOGLE_SECRET,
	AUTH_DISCORD_ID: env.AUTH_DISCORD_ID,
	AUTH_DISCORD_SECRET: env.AUTH_DISCORD_SECRET
};

/**
 * Auth.js is configured **per request**, not at module load: its Drizzle adapter
 * needs a database, and on Cloudflare the database only exists once a request
 * arrives with its D1 binding (see `db/index.ts`). `hooks.server.ts` resolves it
 * onto `locals.db` before this handle runs; a direct hit on `/auth/*` that
 * somehow arrives without it falls back to resolving one from the platform.
 */
export const { handle, signIn, signOut } = SvelteKitAuth(async (event) => {
	const db = event.locals.db ?? (await getDb(event.platform));

	return {
		adapter: DrizzleAdapter(db, {
			usersTable: users,
			accountsTable: accounts,
			sessionsTable: sessions,
			verificationTokensTable: verificationTokens
		}),
		providers: buildProviders(authEnv, db),
		secret: env.AUTH_SECRET,
		trustHost: true,
		// Credentials forces JWT; the id is carried on the token (see callbacks).
		session: { strategy: 'jwt' },
		callbacks: {
			jwt: ({ token, user }) => applyTokenId(token, user),
			session: ({ session, token }) => applySessionId(session, token)
		}
	} satisfies SvelteKitAuthConfig;
});
