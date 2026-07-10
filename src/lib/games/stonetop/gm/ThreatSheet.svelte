<!--
	The Stonetop threat sheet — the read-only, print-friendly view of a threat
	worksheet (phase 7, commit 52). Renders the type, tracker, instinct,
	description, impending doom with its grim portents (marked ones struck
	through), and any stakes/moves. No editing here (that's the editor); the page's
	print CSS drops the app chrome so this prints clean, like the other sheets.
-->
<script lang="ts">
	import type { SheetProps } from '$lib/games/types';
	import type { GmPlaybook } from '../pack-schemas';
	import { THREAT_TRACKER_LABELS, type StonetopThreat } from '../engine/threat';
	import { fetchGmPack } from '../pack/gm';

	let { character }: SheetProps = $props();
	const s = $derived(character as StonetopThreat);

	let pack = $state<GmPlaybook | null>(null);

	$effect(() => {
		let alive = true;
		fetchGmPack(fetch)
			.then((p) => alive && (pack = p))
			.catch(() => {});
		return () => (alive = false);
	});

	const typeName = $derived(
		pack?.threats.types.find((t) => t.id === s.threatType)?.name ?? s.threatType
	);
	const subtitle = $derived(
		[typeName, THREAT_TRACKER_LABELS[s.tracker]].filter(Boolean).join(' · ')
	);
</script>

<article class="threat-sheet mx-auto max-w-3xl space-y-6">
	<header class="border-b-2 border-accent pb-3">
		<h1 class="text-3xl font-bold tracking-tight">{s.name || 'Unnamed threat'}</h1>
		{#if subtitle}<p class="text-lg text-muted">{subtitle}</p>{/if}
	</header>

	{#if s.instinct}
		<section>
			<h2 class="text-sm font-semibold tracking-wide text-muted uppercase">Instinct</h2>
			<p class="mt-1">{s.instinct}</p>
		</section>
	{/if}

	{#if s.description}
		<section>
			<h2 class="text-sm font-semibold tracking-wide text-muted uppercase">Description</h2>
			<p class="mt-1 whitespace-pre-line">{s.description}</p>
		</section>
	{/if}

	{#if s.impendingDoom || s.grimPortents.length}
		<section>
			<h2 class="text-lg font-semibold">Impending doom</h2>
			{#if s.impendingDoom}<p class="mt-1 whitespace-pre-line">{s.impendingDoom}</p>{/if}
			{#if s.grimPortents.length}
				<ul class="mt-2 space-y-1 text-sm">
					{#each s.grimPortents as portent, i (i)}
						<li class="flex items-baseline gap-2">
							<span aria-hidden="true">{portent.marked ? '☑' : '☐'}</span>
							<span class={portent.marked ? 'text-muted line-through' : ''}>{portent.text}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if s.stakes.length}
		<section>
			<h2 class="text-lg font-semibold">Stakes</h2>
			<ul class="mt-1 list-disc pl-5 text-sm">
				{#each s.stakes as q, i (i)}<li>{q}</li>{/each}
			</ul>
		</section>
	{/if}

	{#if s.moves.length}
		<section>
			<h2 class="text-lg font-semibold">GM moves</h2>
			<ul class="mt-1 list-disc pl-5 text-sm">
				{#each s.moves as m, i (i)}<li>{m}</li>{/each}
			</ul>
		</section>
	{/if}

	{#if s.customMoves.length}
		<section>
			<h2 class="text-lg font-semibold">Custom player moves</h2>
			<ul class="mt-1 list-disc pl-5 text-sm">
				{#each s.customMoves as m, i (i)}<li>{m}</li>{/each}
			</ul>
		</section>
	{/if}
</article>
