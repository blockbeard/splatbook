/**
 * Client-side save/load helpers — the browser half of persistence.
 *
 * The wizard autosaves an opaque draft to localStorage while you work (signed
 * in or not). These helpers push a draft to the database and, when you sign in,
 * migrate any local drafts up so nothing built-while-logged-out is lost. The
 * key-parsing bits are pure and unit-tested; the network/storage bits take
 * injectable `fetch`/`Storage` so they're testable too.
 */

import { getGame } from '$lib/games';
import { draftKey, type DraftStorage } from '$lib/wizard';

/** Payload POSTed to `/api/entities`. Mirrors the endpoint's Zod schema. */
export interface SavePayload {
	id?: string;
	gameId: string;
	entityType: string;
	name: string;
	data: unknown;
	schemaVersion: number;
	status?: 'draft' | 'ready' | 'archived';
}

/** A saved entity as returned by the API (subset the client needs). */
export interface SavedEntity {
	id: string;
	name: string;
	status: string;
}

const DRAFT_PREFIX = 'splatbook:draft:';

/**
 * Build a save payload from a game's draft using its `entityMeta`. Returns
 * `null` if the game can't describe its entities (no `entityMeta`), so callers
 * can skip persistence cleanly rather than guessing at the blob.
 */
export function draftToPayload(
	gameId: string,
	draft: object,
	overrides: Partial<SavePayload> = {}
): SavePayload | null {
	const game = getGame(gameId);
	const meta = game?.entityMeta?.(draft);
	if (!meta) return null;
	return {
		gameId,
		entityType: meta.entityType,
		name: meta.name,
		schemaVersion: meta.schemaVersion,
		data: draft,
		...overrides
	};
}

/** POST a payload; returns the saved entity. Throws on a non-OK response. */
export async function saveEntity(
	payload: SavePayload,
	fetchFn: typeof fetch = fetch
): Promise<SavedEntity> {
	const res = await fetchFn('/api/entities', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
	if (!res.ok) throw new Error(`Save failed (${res.status})`);
	return res.json();
}

/** The parts of a `splatbook:draft:<game>:<type>:<id>` key. */
export interface ParsedDraftKey {
	gameId: string;
	entityType: string;
	draftId: string;
}

/** Parse a draft storage key, or `null` if it isn't one of ours. */
export function parseDraftKey(key: string): ParsedDraftKey | null {
	if (!key.startsWith(DRAFT_PREFIX)) return null;
	const [gameId, entityType, draftId] = key.slice(DRAFT_PREFIX.length).split(':');
	if (!gameId || !entityType || !draftId) return null;
	return { gameId, entityType, draftId };
}

/** All draft keys currently in a storage, in insertion order. */
export function localDraftKeys(storage: Pick<Storage, 'length' | 'key'>): string[] {
	const keys: string[] = [];
	for (let i = 0; i < storage.length; i++) {
		const k = storage.key(i);
		if (k && k.startsWith(DRAFT_PREFIX)) keys.push(k);
	}
	return keys;
}

/**
 * Push every local draft to the database, clearing each on success. Called once
 * after sign-in. Best-effort: a draft that fails to save is left in place so a
 * later attempt can retry, and one failure doesn't block the others.
 *
 * Returns how many drafts were migrated.
 */
export async function migrateLocalDrafts(
	storage: DraftStorage & Pick<Storage, 'length' | 'key'>,
	fetchFn: typeof fetch = fetch
): Promise<number> {
	let migrated = 0;
	for (const key of localDraftKeys(storage)) {
		const parsed = parseDraftKey(key);
		const raw = storage.getItem(key);
		if (!parsed || raw === null) continue;
		let draft: object;
		try {
			draft = JSON.parse(raw);
		} catch {
			continue;
		}
		const payload = draftToPayload(parsed.gameId, draft);
		if (!payload) continue;
		try {
			await saveEntity(payload, fetchFn);
			storage.removeItem(key);
			migrated++;
		} catch {
			// Leave the draft for a later retry.
		}
	}
	return migrated;
}

export { draftKey };
