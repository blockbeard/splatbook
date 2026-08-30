/**
 * Loading the Origins 5.5e pack from the served content pack.
 *
 * Pack JSON is validated at build/CI (`npm run validate:packs`), so the runtime
 * trusts it and skips re-parsing through Zod — the same bargain the reference
 * and Stonetop loaders make.
 *
 * Unlike Stonetop's playbooks, an Origins builder needs nearly the whole pack
 * on nearly every step (the abilities step wants the background's increases,
 * the equipment step wants the reference class *and* the armor table), so this
 * fetches it once as a unit and memoises the promise. Eight small files in
 * parallel, once per session.
 */

import { base } from '$app/paths';
import type {
	Backgrounds,
	Equipment,
	Feats,
	OriginsRules,
	ReferenceClasses,
	ReferenceData,
	SpeciesPack,
	Spells
} from '../pack-schemas';

const GAME_ID = 'origins';

/** The subset of `fetch` a SvelteKit `load` (or the browser) provides. */
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** Everything the builder reads, in one bag. */
export interface OriginsPack {
	rules: OriginsRules;
	backgrounds: Backgrounds['backgrounds'];
	species: SpeciesPack['species'];
	referenceClasses: ReferenceClasses['referenceClasses'];
	feats: Feats['feats'];
	equipment: Equipment;
	spells: Spells['spells'];
	reference: ReferenceData;
}

async function getJson<T>(fetchFn: Fetcher, file: string): Promise<T> {
	const url = `${base}/content-packs/${GAME_ID}/${file}`;
	const res = await fetchFn(url);
	if (!res.ok) throw new Error(`origins: failed to load ${url} (${res.status})`);
	return (await res.json()) as T;
}

let cached: Promise<OriginsPack> | null = null;

/** Fetch (once) and return the whole pack. */
export function loadPack(fetchFn: Fetcher): Promise<OriginsPack> {
	cached ??= (async () => {
		const [rules, backgrounds, species, referenceClasses, feats, equipment, spells, reference] =
			await Promise.all([
				getJson<OriginsRules>(fetchFn, 'data/origins-rules.json'),
				getJson<Backgrounds>(fetchFn, 'data/backgrounds.json'),
				getJson<SpeciesPack>(fetchFn, 'data/species.json'),
				getJson<ReferenceClasses>(fetchFn, 'data/reference-classes.json'),
				getJson<Feats>(fetchFn, 'data/feats.json'),
				getJson<Equipment>(fetchFn, 'data/equipment.json'),
				getJson<Spells>(fetchFn, 'data/spells.json'),
				getJson<ReferenceData>(fetchFn, 'data/reference.json')
			]);
		return {
			rules,
			backgrounds: backgrounds.backgrounds,
			species: species.species,
			referenceClasses: referenceClasses.referenceClasses,
			feats: feats.feats,
			equipment,
			spells: spells.spells,
			reference
		};
	})().catch((e: unknown) => {
		// A failed load must not poison every later attempt.
		cached = null;
		throw e;
	});
	return cached;
}

/** Test/HMR helper — forget the memoised pack. */
export function resetPackCache(): void {
	cached = null;
}

/** The `PackContext` the engine's derivations take, assembled from a character. */
export function packContext(
	pack: OriginsPack,
	backgroundId: string | null,
	referenceClassId: string | null,
	speciesId: string | null = null
) {
	return {
		rules: pack.rules,
		reference: pack.reference,
		equipment: pack.equipment,
		background: pack.backgrounds.find((b) => b.id === backgroundId) ?? null,
		referenceClass: pack.referenceClasses.find((c) => c.id === referenceClassId) ?? null,
		species: pack.species.find((s) => s.id === speciesId) ?? null
	};
}
