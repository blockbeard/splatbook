<!--
	The Stonetop steading sheet — the read-only, print-friendly view of a steading
	(phase 6, commit 48). Renders the current stats, marked debilities, the
	content lists, completed Improvements, and the resident/neighbour rosters. No
	editing here (that's the editor); the page's print CSS drops the app chrome so
	this prints clean, like the character sheet.
-->
<script lang="ts">
	import type { SheetProps } from '$lib/games/types';
	import type { SteadingPack } from '../pack-schemas';
	import {
		STEADING_STAT_KEYS,
		STEADING_STATS,
		STEADING_DEBILITY_KEYS,
		effectiveSteadingStat,
		isDebilitated,
		type StonetopSteading
	} from '../engine/steading';
	import { fetchSteadingPack } from '../pack/steading';
	import Markdown from '../wizard/components/Markdown.svelte';

	let { character }: SheetProps = $props();
	const s = $derived(character as StonetopSteading);

	let pack = $state<SteadingPack | null>(null);

	$effect(() => {
		let alive = true;
		fetchSteadingPack(fetch)
			.then((p) => alive && (pack = p))
			.catch(() => {});
		return () => (alive = false);
	});

	const fmt = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

	const debilityName = $derived(
		new Map((pack?.debilities ?? []).map((d) => [d.id, d.name] as const))
	);
	const markedDebilities = $derived(STEADING_DEBILITY_KEYS.filter((k) => isDebilitated(s, k)));
	// Completed Improvements, matched to their pack names/effects.
	const completed = $derived(
		(pack?.improvements ?? []).filter((imp) => s.improvements[imp.id]?.completed)
	);
</script>

<article class="steading-sheet mx-auto max-w-3xl space-y-6">
	<header class="border-b-2 border-accent pb-3">
		<h1 class="text-3xl font-bold tracking-tight">{s.name || 'Unnamed steading'}</h1>
		<p class="text-lg text-muted">
			<span class="capitalize">{s.size}</span> · {s.season}
		</p>
	</header>

	<section>
		<h2 class="text-lg font-semibold">Stats</h2>
		<div class="mt-2 flex flex-wrap gap-3">
			{#each STEADING_STAT_KEYS as key (key)}
				<div class="min-w-20 rounded-md border border-border px-3 py-2 text-center">
					<div class="font-mono text-xl font-bold">
						{key === 'surplus' ? s.stats[key] : fmt(s.stats[key])}
					</div>
					<div class="text-xs font-medium text-muted">{STEADING_STATS[key].label}</div>
					{#if key === 'prosperity' && s.debilities.lacking}
						<div class="text-[0.65rem] text-danger">counts as {fmt(effectiveSteadingStat(s, key))}</div>
					{/if}
				</div>
			{/each}
		</div>
		{#if markedDebilities.length}
			<p class="mt-2 text-sm text-danger">
				Debilities: {markedDebilities.map((k) => debilityName.get(k) ?? k).join(', ')}
			</p>
		{/if}
	</section>

	{#if s.resources.length}
		<section>
			<h2 class="text-lg font-semibold">Resources</h2>
			<ul class="mt-1 list-disc pl-5 text-sm">
				{#each s.resources as r, i (i)}<li>{r}</li>{/each}
			</ul>
		</section>
	{/if}

	{#if s.fortifications.length}
		<section>
			<h2 class="text-lg font-semibold">Fortifications</h2>
			<ul class="mt-1 list-disc pl-5 text-sm">
				{#each s.fortifications as f, i (i)}<li>{f}</li>{/each}
			</ul>
		</section>
	{/if}

	{#if s.placesOfInterest.length}
		<section>
			<h2 class="text-lg font-semibold">Places of Interest</h2>
			<ul class="mt-1 space-y-0.5 text-sm">
				{#each s.placesOfInterest as p, i (i)}
					<li><span class="font-mono font-semibold">{p.marker}</span> — {p.name}</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if s.assets.length || s.treasure.silver || s.treasure.gold}
		<section>
			<h2 class="text-lg font-semibold">Assets</h2>
			{#if s.assets.length}
				<ul class="mt-1 list-disc pl-5 text-sm">
					{#each s.assets as a, i (i)}<li>{a}</li>{/each}
				</ul>
			{/if}
			{#if s.treasure.silver || s.treasure.gold}
				<p class="mt-1 text-sm text-muted">
					{#if s.treasure.silver}Silver: {s.treasure.silver}{/if}
					{#if s.treasure.silver && s.treasure.gold}
						·
					{/if}
					{#if s.treasure.gold}Gold: {s.treasure.gold}{/if}
				</p>
			{/if}
		</section>
	{/if}

	{#if completed.length}
		<section>
			<h2 class="text-lg font-semibold">Improvements</h2>
			<div class="mt-1 space-y-2">
				{#each completed as imp (imp.id)}
					<div>
						<div class="font-medium">{imp.name}</div>
						<div class="text-sm text-muted"><Markdown text={imp.effects} /></div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if s.residents.length}
		<section>
			<h2 class="text-lg font-semibold">Residents</h2>
			<table class="mt-1 w-full text-left text-sm">
				<tbody>
					{#each s.residents as r, i (i)}
						<tr class="border-b border-border">
							<td class="py-1 pr-3 font-medium">{r.name}</td>
							<td class="py-1 pr-3 text-muted">{r.occupation}</td>
							<td class="py-1 text-muted">{r.notes}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}

	{#if s.neighbors.length}
		<section>
			<h2 class="text-lg font-semibold">Neighbors</h2>
			<table class="mt-1 w-full text-left text-sm">
				<tbody>
					{#each s.neighbors as r, i (i)}
						<tr class="border-b border-border">
							<td class="py-1 pr-3 font-medium">{r.name}</td>
							<td class="py-1 pr-3 text-muted">{r.home}</td>
							<td class="py-1 pr-3 text-muted">{r.occupation}</td>
							<td class="py-1 text-muted">{r.notes}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</article>
