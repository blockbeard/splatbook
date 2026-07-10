import { base } from '$app/paths';
import { listGames } from '$lib/games';
import { licenseInfo, type LicenseInfo } from '$lib/credits';
import type { PackManifest } from '$lib/packs/types';
import type { PageLoad } from './$types';

/** One game's text licensing, for the credits page. */
export interface GameCredit {
	id: string;
	name: string;
	license: LicenseInfo;
	attribution: string;
}

/**
 * Build the credits page's per-game licensing from each registered game's pack
 * manifest (its declared `license` + `attribution`) — data-driven, so a new game
 * appears here the moment it's registered, with no edit to this page. The
 * manifests are validated at build/CI, so the fetched JSON is trusted.
 */
export const load: PageLoad = async ({ fetch }) => {
	const games = await Promise.all(
		listGames().map(async (g): Promise<GameCredit | null> => {
			const res = await fetch(`${base}/content-packs/${g.id}/manifest.json`);
			if (!res.ok) return null;
			const m = (await res.json()) as PackManifest;
			return {
				id: g.id,
				name: m.name ?? g.name,
				license: licenseInfo(m.license),
				attribution: m.attribution
			};
		})
	);
	return { games: games.filter((g): g is GameCredit => g !== null) };
};
