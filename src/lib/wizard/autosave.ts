/**
 * Wizard autosave — persisting the working draft so a half-built character
 * survives a reload. Pure over an injected `DraftStorage`, so the logic is
 * testable with an in-memory fake and the Svelte component simply passes the
 * browser's `localStorage`.
 *
 * On sign-in (phase 4) a local draft migrates into the database; until then
 * this is the only persistence the wizard has.
 */

/** The slice of the Web Storage API the wizard needs (satisfied by `localStorage`). */
export interface DraftStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** Namespaced key for a draft entity: `splatbook:draft:<game>:<entityType>:<id>`. */
export function draftKey(gameId: string, entityType: string, draftId: string): string {
	return `splatbook:draft:${gameId}:${entityType}:${draftId}`;
}

/** Serialize and store a draft. */
export function saveDraft(storage: DraftStorage, key: string, draft: unknown): void {
	storage.setItem(key, JSON.stringify(draft));
}

/**
 * Load a draft, or `null` when absent or corrupt. A parse failure is treated
 * as "no draft" rather than thrown: a mangled autosave should never wedge the
 * wizard on open.
 */
export function loadDraft<T = unknown>(storage: DraftStorage, key: string): T | null {
	const raw = storage.getItem(key);
	if (raw === null) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

/** Remove a stored draft (e.g. after the character is saved to the database). */
export function clearDraft(storage: DraftStorage, key: string): void {
	storage.removeItem(key);
}
