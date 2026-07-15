/**
 * Loading Stonetop insert data from the served content pack. Like the playbook
 * loader, pack JSON is validated at build/CI, so the runtime trusts it.
 */

import { base } from '$app/paths';
import type { FollowersInsert, InventoryInsert } from '../pack-schemas';

const GAME_ID = 'stonetop';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** A memoised fetch-and-parse for one insert file, keyed by its own cache slot. */
function cachedInsertFetcher<T>(fileName: string) {
	let cache: Promise<T> | null = null;
	return (fetchFn: Fetcher): Promise<T> => {
		if (cache) return cache;
		const url = `${base}/content-packs/${GAME_ID}/data/${fileName}`;
		cache = fetchFn(url)
			.then((res) => {
				if (!res.ok) throw new Error(`stonetop: failed to load ${url} (${res.status})`);
				return res.json() as Promise<T>;
			})
			.catch((err) => {
				cache = null; // don't cache a transient failure
				throw err;
			});
		return cache;
	};
}

/** Fetch the standard Inventory insert (memoised). */
export const fetchInventory = cachedInsertFetcher<InventoryInsert>('insert-inventory.json');

/** Fetch the generic Followers insert (memoised). */
export const fetchFollowersInsert = cachedInsertFetcher<FollowersInsert>('insert-followers.json');
