/**
 * Client-side preference storage — the signed-out half of the preferences
 * story (phase 13). A signed-in reader's preferences live server-side
 * (`$lib/server/db/preferences`, read into `locals.prefs`); a signed-out
 * reader gets the same key/value shape in `localStorage` instead, under the
 * same namespaced-key convention `$lib/entities/client`'s drafts use.
 *
 * There is deliberately no migrate-on-sign-in here (unlike drafts): a
 * preference set while signed out is a browser default, not something the
 * reader is trusting the server to keep. On sign-in the server value (if
 * any) simply takes over; the local one is left alone rather than pushed up,
 * so switching accounts on a shared machine never leaks one account's
 * preference into another's row.
 */

const PREF_PREFIX = 'splatbook:pref:';

/** The slice of the Web Storage API preferences need (satisfied by `localStorage`). */
export interface PrefStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** Namespaced key for a preference: `splatbook:pref:<key>`. */
export function prefKey(key: string): string {
	return `${PREF_PREFIX}${key}`;
}

/** Read a locally-stored preference, or `null` if unset. */
export function getLocalPreference(storage: PrefStorage, key: string): string | null {
	return storage.getItem(prefKey(key));
}

/** Store a preference locally. */
export function setLocalPreference(storage: PrefStorage, key: string, value: string): void {
	storage.setItem(prefKey(key), value);
}

/** Clear a locally-stored preference, reverting to the reading feature's own default. */
export function clearLocalPreference(storage: PrefStorage, key: string): void {
	storage.removeItem(prefKey(key));
}

/**
 * Save a preference wherever it belongs for this viewer: `PUT
 * /api/preferences` when signed in, `localStorage` otherwise. A caller that
 * needs a `load` to notice the change (the reference's spoiler gate) calls
 * `invalidate()` itself afterwards — only the caller knows which dependency
 * key applies, so this stays a plain write with no SvelteKit imports.
 */
export async function savePreference(
	key: string,
	value: string,
	opts: { signedIn: boolean; storage?: PrefStorage; fetchFn?: typeof fetch } = { signedIn: false }
): Promise<void> {
	if (opts.signedIn) {
		const res = await (opts.fetchFn ?? fetch)('/api/preferences', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key, value })
		});
		if (!res.ok) throw new Error(`Failed to save preference (${res.status})`);
	} else {
		setLocalPreference(opts.storage ?? localStorage, key, value);
	}
}
