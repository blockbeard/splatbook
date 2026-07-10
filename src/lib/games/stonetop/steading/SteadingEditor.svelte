<!--
	Stonetop steading editor — the editable tracker sheet for the steading entity
	type. It has no build wizard: a steading is edited in place from creation.
	This screen (phase 6, commit 44) is the core tracker — the six steading stats
	(Fortunes/Surplus/Size/Population/Prosperity/Defenses), the season, and the
	three debilities. Resources/improvements/residents fill in over the following
	commits. Every edit runs a pure engine function and hands the new steading up
	via `onChange`, which the route autosaves.
-->
<script lang="ts">
	import type { PlayProps } from '$lib/games/types';
	import type { SteadingPack } from '../pack-schemas';
	import {
		STEADING_STAT_KEYS,
		STEADING_STATS,
		STEADING_DEBILITY_KEYS,
		SIZE_LADDER,
		SEASONS,
		bumpStat,
		bumpSize,
		setSeason,
		statAtMin,
		statAtMax,
		toggleDebility,
		isDebilitated,
		migrateSteading,
		seedFromPack,
		setList,
		setPlaces,
		setTreasure,
		setResidents,
		setNeighbors,
		type SteadingStatKey,
		type SteadingDebilityKey,
		type SteadingListKey,
		type Season,
		type PlaceOfInterest,
		type Treasure,
		type ResidentRow,
		type NeighborRow,
		type StonetopSteading
	} from '../engine/steading';
	import { fetchSteadingPack } from '../pack/steading';
	import SteadingImprovements from './SteadingImprovements.svelte';
	import EditableList from './EditableList.svelte';
	import PlacesList from './PlacesList.svelte';
	import ResidentsTable from './ResidentsTable.svelte';
	import NeighborsTable from './NeighborsTable.svelte';

	let { character, onChange }: PlayProps = $props();
	const s = $derived(character as StonetopSteading);
	const emit = (next: StonetopSteading): void => onChange(next);

	let pack = $state<SteadingPack | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		fetchSteadingPack(fetch)
			.then((p) => alive && (pack = p))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	// Once the pack is loaded, migrate an older blob and seed a fresh steading's
	// starting content. Both are idempotent (seed is a no-op once `seeded`), so
	// this emits exactly once for a new draft and never loops.
	$effect(() => {
		if (!pack) return;
		const prepared = seedFromPack(migrateSteading(s), pack);
		if (JSON.stringify(prepared) !== JSON.stringify(s)) onChange(prepared);
	});

	const fmt = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

	const rename = (name: string): void => onChange({ ...s, name });
	const nudgeStat = (key: SteadingStatKey, delta: number): void =>
		onChange(bumpStat(s, key, delta));
	const nudgeSize = (delta: number): void => onChange(bumpSize(s, delta));
	const pickSeason = (season: Season): void => onChange(setSeason(s, season));
	const flipDebility = (key: SteadingDebilityKey): void => onChange(toggleDebility(s, key));
	const editList = (key: SteadingListKey, items: string[]): void =>
		onChange(setList(s, key, items));
	const editPlaces = (places: PlaceOfInterest[]): void => onChange(setPlaces(s, places));
	const editTreasure = (patch: Partial<Treasure>): void =>
		onChange(setTreasure(s, { ...s.treasure, ...patch }));
	const editResidents = (rows: ResidentRow[]): void => onChange(setResidents(s, rows));
	const editNeighbors = (rows: NeighborRow[]): void => onChange(setNeighbors(s, rows));

	// Pack lookups for display text (game strings live in the pack, not here).
	const debilityInfo = $derived(new Map((pack?.debilities ?? []).map((d) => [d.id, d] as const)));
	const sizeNote = $derived(
		new Map((pack?.stats.size.options ?? []).map((o) => [o.id, o.note ?? ''] as const))
	);
</script>

{#if loadError}
	<p class="text-muted">Couldn’t load the steading pack: {loadError}</p>
{:else if !pack}
	<p class="text-muted">Loading…</p>
{:else}
	<article class="mx-auto max-w-3xl space-y-8">
		<header class="border-b-2 border-accent pb-3">
			<label class="block">
				<span class="text-xs font-medium tracking-wide text-muted uppercase">Steading</span>
				<input
					type="text"
					value={s.name}
					oninput={(e) => rename(e.currentTarget.value)}
					placeholder="Name your steading"
					class="mt-1 w-full border-0 border-b border-transparent bg-transparent text-3xl font-bold tracking-tight focus:border-accent focus:ring-0 focus:outline-none"
				/>
			</label>
		</header>

		<section>
			<h2 class="text-lg font-semibold">Stats</h2>
			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				<!-- Size — a ladder, stepped separately from the numeric tracks. -->
				<div class="rounded-md border border-border p-3">
					<div class="flex items-center justify-between">
						<span class="font-medium">Size</span>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => nudgeSize(-1)}
								disabled={s.size === SIZE_LADDER[0]}
								aria-label="Decrease Size"
								class="h-7 w-7 rounded border border-border text-lg leading-none disabled:opacity-30 hover:enabled:bg-surface"
								>−</button
							>
							<span class="min-w-20 text-center font-mono text-sm capitalize">{s.size}</span>
							<button
								type="button"
								onclick={() => nudgeSize(1)}
								disabled={s.size === SIZE_LADDER[SIZE_LADDER.length - 1]}
								aria-label="Increase Size"
								class="h-7 w-7 rounded border border-border text-lg leading-none disabled:opacity-30 hover:enabled:bg-surface"
								>+</button
							>
						</div>
					</div>
					{#if sizeNote.get(s.size)}
						<p class="mt-1 text-xs text-muted">{sizeNote.get(s.size)}</p>
					{/if}
				</div>

				<!-- The five numeric tracks. -->
				{#each STEADING_STAT_KEYS as key (key)}
					{@const def = STEADING_STATS[key]}
					{@const val = s.stats[key]}
					<div class="rounded-md border border-border p-3">
						<div class="flex items-center justify-between">
							<span class="font-medium">{def.label}</span>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => nudgeStat(key, -1)}
									disabled={statAtMin(key, val)}
									aria-label={`Decrease ${def.label}`}
									class="h-7 w-7 rounded border border-border text-lg leading-none disabled:opacity-30 hover:enabled:bg-surface"
									>−</button
								>
								<span class="min-w-10 text-center font-mono text-lg font-bold">
									{key === 'surplus' ? val : fmt(val)}
								</span>
								<button
									type="button"
									onclick={() => nudgeStat(key, 1)}
									disabled={statAtMax(key, val)}
									aria-label={`Increase ${def.label}`}
									class="h-7 w-7 rounded border border-border text-lg leading-none disabled:opacity-30 hover:enabled:bg-surface"
									>+</button
								>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">Season</h2>
			<div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Season">
				{#each SEASONS as season (season)}
					<button
						type="button"
						onclick={() => pickSeason(season)}
						aria-pressed={s.season === season}
						class="rounded-md border px-3 py-1.5 text-sm capitalize transition-colors {s.season ===
						season
							? 'border-accent bg-accent/10 font-medium'
							: 'border-border hover:bg-surface'}"
					>
						{season}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<div class="flex items-baseline justify-between">
				<h2 class="text-lg font-semibold">Debilities</h2>
				<span class="text-sm text-muted">Tap to mark</span>
			</div>
			<div class="mt-2 space-y-2">
				{#each STEADING_DEBILITY_KEYS as key (key)}
					{@const info = debilityInfo.get(key)}
					{@const marked = isDebilitated(s, key)}
					<button
						type="button"
						onclick={() => flipDebility(key)}
						aria-pressed={marked}
						class="w-full rounded-md border p-3 text-left transition-colors {marked
							? 'border-danger bg-danger/10'
							: 'border-border hover:bg-surface'}"
					>
						<div class="font-medium capitalize {marked ? 'text-danger' : ''}">
							{info?.name ?? key}
						</div>
						{#if info}
							<div class="text-xs text-muted">{info.effect}</div>
						{/if}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">Resources</h2>
			<div class="mt-2">
				<EditableList
					items={s.resources}
					onChange={(items) => editList('resources', items)}
					addLabel="Resource"
					placeholder="Resource"
					writeInsHint={pack.resources.writeIns}
				/>
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">Fortifications</h2>
			<div class="mt-2">
				<EditableList
					items={s.fortifications}
					onChange={(items) => editList('fortifications', items)}
					addLabel="Fortification"
					placeholder="Fortification"
					writeInsHint={pack.fortifications.writeIns}
				/>
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">Places of Interest</h2>
			<div class="mt-2">
				<PlacesList
					places={s.placesOfInterest}
					writeInMarkers={pack.placesOfInterest.writeInMarkers}
					onChange={editPlaces}
				/>
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">Assets</h2>
			<p class="text-sm text-muted">{pack.assets.text}</p>
			<div class="mt-2">
				<EditableList
					items={s.assets}
					onChange={(items) => editList('assets', items)}
					addLabel="Asset"
					placeholder="Asset"
					writeInsHint={pack.assets.writeIns}
				/>
			</div>
			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-muted uppercase">Silver</span>
					<input
						type="text"
						value={s.treasure.silver}
						oninput={(e) => editTreasure({ silver: e.currentTarget.value })}
						placeholder="purses, handfuls, coins"
						class="mt-1 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
					/>
				</label>
				<label class="block">
					<span class="text-xs font-medium tracking-wide text-muted uppercase">Gold</span>
					<input
						type="text"
						value={s.treasure.gold}
						oninput={(e) => editTreasure({ gold: e.currentTarget.value })}
						placeholder="purses, handfuls, coins"
						class="mt-1 w-full rounded border border-border bg-transparent px-2 py-1 text-sm focus:border-accent focus:ring-0 focus:outline-none"
					/>
				</label>
			</div>
		</section>

		<section>
			<div class="flex items-baseline justify-between">
				<h2 class="text-lg font-semibold">Improvements</h2>
				<span class="text-sm text-muted">Tick what you've built</span>
			</div>
			<div class="mt-2">
				<SteadingImprovements improvements={pack.improvements} steading={s} onChange={emit} />
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">Residents</h2>
			<p class="text-sm text-muted">{pack.residents.text}</p>
			<div class="mt-2">
				<ResidentsTable
					residents={s.residents}
					names={pack.residents.names}
					occupations={pack.residents.prefilledOccupations}
					traits={pack.residents.npcTraits}
					onChange={editResidents}
				/>
			</div>
		</section>

		<section>
			<h2 class="text-lg font-semibold">Neighbors</h2>
			<p class="text-sm text-muted">{pack.neighbors.text}</p>
			<div class="mt-2">
				<NeighborsTable
					neighbors={s.neighbors}
					places={pack.neighbors.places}
					onChange={editNeighbors}
				/>
			</div>
		</section>
	</article>
{/if}
