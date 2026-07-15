/**
 * Loading Stonetop insert data from the served content pack. Like the playbook
 * loader, pack JSON is validated at build/CI, so the runtime trusts it.
 */

import { base } from '$app/paths';
import type {
	AnimalCompanionInsert,
	CrewInsert,
	FollowersInsert,
	InitiatesOfDanuInsert,
	InventoryInsert,
	InvocationsInsert
} from '../pack-schemas';

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

/** Fetch the Lightbearer's Invocations insert (memoised). */
export const fetchInvocationsInsert =
	cachedInsertFetcher<InvocationsInsert>('insert-invocations.json');

/** Fetch the Ranger's Animal Companion insert (memoised). */
export const fetchAnimalCompanionInsert = cachedInsertFetcher<AnimalCompanionInsert>(
	'insert-animal-companion.json'
);

/** Fetch the Blessed's Initiates of Danu insert (memoised). */
export const fetchInitiatesOfDanuInsert = cachedInsertFetcher<InitiatesOfDanuInsert>(
	'insert-initiates-of-danu.json'
);

/** Fetch the Marshal's Crew insert (memoised). */
export const fetchCrewInsert = cachedInsertFetcher<CrewInsert>('insert-crew.json');
