/**
 * Loading the basic moves from the served content pack. Like the playbook and
 * insert loaders, pack JSON is validated at build/CI, so the runtime trusts it.
 */

import { base } from '$app/paths';
import type { BasicMoves } from '../pack-schemas';

const GAME_ID = 'stonetop';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

let cache: Promise<BasicMoves> | null = null;

/** Fetch the basic moves every character can make (memoised). */
export function fetchBasicMoves(fetchFn: Fetcher): Promise<BasicMoves> {
	if (cache) return cache;
	const url = `${base}/content-packs/${GAME_ID}/data/basic-moves.json`;
	cache = fetchFn(url)
		.then((res) => {
			if (!res.ok) throw new Error(`stonetop: failed to load ${url} (${res.status})`);
			return res.json() as Promise<BasicMoves>;
		})
		.catch((err) => {
			cache = null; // don't cache a transient failure
			throw err;
		});
	return cache;
}
