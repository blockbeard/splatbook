/**
 * User preference persistence — the `preferences` table's read/write layer
 * (phase 13). Like the other services here, it takes `db` first so tests can
 * drive it against an in-memory database, and it's deliberately unopinionated
 * about what a key/value pair *means*: that's the reading feature's job
 * (`reference.showSetting`, and whatever follows it).
 *
 * There's no `getPreference(db, userId, key)` for a single key: every
 * consumer so far wants "all of this user's preferences" once per request
 * (`hooks.server.ts` populates `locals.prefs` this way), and a flat map is
 * cheap enough at this scale that a second, narrower query would only add a
 * round trip without saving one.
 *
 * Server-only.
 */

import { and, eq } from 'drizzle-orm';
import type { Db } from './entities.ts';
import { preferences } from './schema.ts';

/** Every preference a user has set, as a flat `key -> value` map. Missing
 * keys simply aren't in the map — callers apply their own default. */
export async function getPreferences(db: Db, userId: string): Promise<Record<string, string>> {
	const rows = await db
		.select({ key: preferences.key, value: preferences.value })
		.from(preferences)
		.where(eq(preferences.userId, userId));
	return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Set one preference, creating or overwriting it (upsert on the composite
 * primary key). `value` is a plain string — a feature that needs structure
 * serializes its own (e.g. `"true"`/`"false"` for a checkbox, matching how
 * `localStorage` mirrors it client-side rather than adding a second format
 * only one side would speak).
 */
export async function setPreference(
	db: Db,
	userId: string,
	key: string,
	value: string
): Promise<void> {
	await db
		.insert(preferences)
		.values({ userId, key, value })
		.onConflictDoUpdate({
			target: [preferences.userId, preferences.key],
			set: { value, updatedAt: new Date() }
		});
}

/** Remove one preference, reverting to the reading feature's own default. */
export async function clearPreference(db: Db, userId: string, key: string): Promise<void> {
	await db.delete(preferences).where(and(eq(preferences.userId, userId), eq(preferences.key, key)));
}
