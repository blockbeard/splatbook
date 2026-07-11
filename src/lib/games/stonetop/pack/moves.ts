/**
 * Loading the move lists from the served content pack: the basic moves every
 * character can make, and the moves a steading rolls. Like the playbook and
 * insert loaders, pack JSON is validated at build/CI, so the runtime trusts it.
 */

import { base } from '$app/paths';
import type { BasicMoves, EndOfSession, SteadingMoves } from '../pack-schemas';

const GAME_ID = 'stonetop';

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const cache = new Map<string, Promise<unknown>>();

function fetchMoves<T>(file: string, fetchFn: Fetcher): Promise<T> {
	const cached = cache.get(file);
	if (cached) return cached as Promise<T>;

	const url = `${base}/content-packs/${GAME_ID}/data/${file}`;
	const promise = fetchFn(url)
		.then((res) => {
			if (!res.ok) throw new Error(`stonetop: failed to load ${url} (${res.status})`);
			return res.json() as Promise<T>;
		})
		.catch((err) => {
			cache.delete(file); // don't cache a transient failure
			throw err;
		});
	cache.set(file, promise);
	return promise;
}

/** The basic moves every character can make (memoised). */
export function fetchBasicMoves(fetchFn: Fetcher): Promise<BasicMoves> {
	return fetchMoves<BasicMoves>('basic-moves.json', fetchFn);
}

/** The moves a steading rolls — Seasons Change, Deploy, Muster… (memoised). */
export function fetchSteadingMoves(fetchFn: Fetcher): Promise<SteadingMoves> {
	return fetchMoves<SteadingMoves>('steading-moves.json', fetchFn);
}

/** The end-of-session move: personal prompts, group questions, closing prose. */
export function fetchEndOfSession(fetchFn: Fetcher): Promise<EndOfSession> {
	return fetchMoves<EndOfSession>('end-of-session.json', fetchFn);
}
