/**
 * Loading the Stonetop steading pack from the served content pack. Like the
 * playbook and insert loaders, the JSON is validated at build/CI (against
 * `steadingSchema`), so the runtime trusts it. Memoised — the editor and sheet
 * both read it.
 */

import { base } from '$app/paths';
import type { SteadingPack } from '../pack-schemas';

const GAME_ID = 'stonetop';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

let cache: Promise<SteadingPack> | null = null;

/** Fetch the steading pack (`data/the-steading.json`), memoised. */
export function fetchSteadingPack(fetchFn: Fetcher): Promise<SteadingPack> {
	if (cache) return cache;
	const url = `${base}/content-packs/${GAME_ID}/data/the-steading.json`;
	cache = fetchFn(url)
		.then((res) => {
			if (!res.ok) throw new Error(`stonetop: failed to load ${url} (${res.status})`);
			return res.json() as Promise<SteadingPack>;
		})
		.catch((err) => {
			cache = null; // don't cache a transient failure
			throw err;
		});
	return cache;
}
