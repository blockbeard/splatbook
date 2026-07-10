/**
 * Loading the Stonetop GM playbook pack (`data/the-gm.json`) from the served
 * content pack. Like the playbook, insert, and steading loaders, the JSON is
 * validated at build/CI (against `gmSchema`), so the runtime trusts it and skips
 * re-parsing through Zod. Memoised — the GM guide's section pages all read it.
 */

import { base } from '$app/paths';
import type { GmPlaybook } from '../pack-schemas';

const GAME_ID = 'stonetop';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

let cache: Promise<GmPlaybook> | null = null;

/** Fetch the GM playbook (`data/the-gm.json`), memoised. */
export function fetchGmPack(fetchFn: Fetcher): Promise<GmPlaybook> {
	if (cache) return cache;
	const url = `${base}/content-packs/${GAME_ID}/data/the-gm.json`;
	cache = fetchFn(url)
		.then((res) => {
			if (!res.ok) throw new Error(`stonetop: failed to load ${url} (${res.status})`);
			return res.json() as Promise<GmPlaybook>;
		})
		.catch((err) => {
			cache = null; // don't cache a transient failure
			throw err;
		});
	return cache;
}
