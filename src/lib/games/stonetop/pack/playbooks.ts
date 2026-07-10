/**
 * Loading Stonetop playbook data from the served content pack.
 *
 * Pack JSON is validated at build/CI (`npm run validate:packs`), so the runtime
 * trusts it and skips re-parsing through Zod — mirroring the reference loader.
 * The playbook-select step needs only id/name/flavor, so `fetchPlaybookSummaries`
 * returns that projection; later steps load the full chosen playbook.
 */

import { base } from '$app/paths';
import type { PackManifest } from '$lib/packs/types';
import type { Playbook } from '../pack-schemas';

/** This module belongs to the `stonetop` game; its pack lives under that id. */
const GAME_ID = 'stonetop';

/** Files matching `data/the-*.json` that are not character playbooks. */
const NON_PLAYBOOK_IDS = new Set(['the-steading', 'the-gm']);

/** The subset of `fetch` a SvelteKit `load` (or the browser) provides. */
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Just enough of a playbook to render the selection step. */
export interface PlaybookSummary {
	id: string;
	name: string;
	/** Evocative intro paragraph (Markdown emphasis). */
	flavor: string;
}

async function getJson<T>(fetchFn: Fetcher, url: string): Promise<T> {
	const res = await fetchFn(url);
	if (!res.ok) throw new Error(`stonetop: failed to load ${url} (${res.status})`);
	return (await res.json()) as T;
}

/** The pack-relative playbook files (excludes the steading and GM sheets). */
export function playbookFiles(manifest: PackManifest): string[] {
	return manifest.files
		.filter((f) => /^data\/the-[a-z-]+\.json$/.test(f))
		.filter((f) => !NON_PLAYBOOK_IDS.has(f.slice('data/'.length, -'.json'.length)))
		.sort();
}

/** Fetch every character playbook and project to id/name/flavor, sorted by name. */
export async function fetchPlaybookSummaries(fetchFn: Fetcher): Promise<PlaybookSummary[]> {
	const root = `${base}/content-packs/${GAME_ID}`;
	const manifest = await getJson<PackManifest>(fetchFn, `${root}/manifest.json`);
	const playbooks = await Promise.all(
		playbookFiles(manifest).map((f) => getJson<Playbook>(fetchFn, `${root}/${f}`))
	);
	return playbooks
		.map(({ id, name, flavor }) => ({ id, name, flavor }))
		.sort((a, b) => a.name.localeCompare(b.name));
}
