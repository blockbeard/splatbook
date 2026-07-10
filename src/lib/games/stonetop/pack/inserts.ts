/**
 * Loading Stonetop insert data from the served content pack. Like the playbook
 * loader, pack JSON is validated at build/CI, so the runtime trusts it.
 */

import { base } from '$app/paths';
import type { InventoryInsert } from '../pack-schemas';

const GAME_ID = 'stonetop';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

let inventoryCache: Promise<InventoryInsert> | null = null;

/** Fetch the standard Inventory insert (memoised). */
export function fetchInventory(fetchFn: Fetcher): Promise<InventoryInsert> {
	if (inventoryCache) return inventoryCache;
	const url = `${base}/content-packs/${GAME_ID}/data/insert-inventory.json`;
	inventoryCache = fetchFn(url)
		.then((res) => {
			if (!res.ok) throw new Error(`stonetop: failed to load ${url} (${res.status})`);
			return res.json() as Promise<InventoryInsert>;
		})
		.catch((err) => {
			inventoryCache = null; // don't cache a transient failure
			throw err;
		});
	return inventoryCache;
}
