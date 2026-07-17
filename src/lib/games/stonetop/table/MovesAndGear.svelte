<!--
	Moves & Gear (commit 113) — the app's equivalent of the printed handout, for
	a player at the table without a character open: the basic moves, the special
	moves (Advantage/Disadvantage, Burn Brightly, End of Session, Death's Door),
	and the gear / small items / prosperity lists the inventory insert already
	carries. Read-only on purpose: marking what you carry is the play sheet's
	job; this page is the thing you glance at mid-scene.

	All three files are the pack's own words, fetched the same way the play
	sheets fetch them (and memoised with them — a table that has a sheet open
	pays nothing extra for this page).
-->
<script lang="ts">
	import { base } from '$app/paths';
	import type { BasicMoves, InventoryInsert, SpecialMoves } from '../pack-schemas';
	import { fetchBasicMoves, fetchSpecialMoves } from '../pack/moves';
	import { fetchInventory } from '../pack/inserts';
	import Markdown from '../wizard/components/Markdown.svelte';

	let basic = $state<BasicMoves | null>(null);
	let special = $state<SpecialMoves | null>(null);
	let inventory = $state<InventoryInsert | null>(null);
	let loadError = $state<string | null>(null);

	$effect(() => {
		let alive = true;
		Promise.all([fetchBasicMoves(fetch), fetchSpecialMoves(fetch), fetchInventory(fetch)])
			.then(([b, s, i]) => {
				if (!alive) return;
				basic = b;
				special = s;
				inventory = i;
			})
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	// Small-item options excluding the blank write-in lines — a handout shows
	// the printed choices, not empty ruling.
	const smallOptions = $derived(inventory?.smallItems.options.filter((o) => o.name) ?? []);
</script>

{#snippet moveCards(moves: { id: string; name: string; text: string; sectionId?: string }[])}
	<div class="mt-3 space-y-4">
		{#each moves as move (move.id)}
			<article class="rounded-lg border border-border p-4">
				<h3 class="font-semibold">
					{#if move.sectionId}
						<!-- Deep-link to the move's full rules (commit 115). -->
						<a
							href="{base}/stonetop/reference/{move.sectionId}"
							class="hover:text-accent hover:underline"
							title="Full rules for {move.name}"
						>
							{move.name}
						</a>
					{:else}
						{move.name}
					{/if}
				</h3>
				<div class="mt-2 text-sm text-muted"><Markdown text={move.text} /></div>
			</article>
		{/each}
	</div>
{/snippet}

{#if loadError}
	<p class="text-muted">Couldn’t load the moves and gear: {loadError}</p>
{:else if !basic || !special || !inventory}
	<p class="text-muted">Loading…</p>
{:else}
	<div class="mx-auto max-w-3xl space-y-10">
		<section>
			<h2 class="border-b-2 border-accent pb-2 text-2xl font-bold tracking-tight">
				{basic.name}
			</h2>
			{@render moveCards(basic.moves)}
		</section>

		<section>
			<h2 class="border-b-2 border-accent pb-2 text-2xl font-bold tracking-tight">
				{special.name}
			</h2>
			{@render moveCards(special.moves)}
		</section>

		<section>
			<h2 class="border-b-2 border-accent pb-2 text-2xl font-bold tracking-tight">
				{inventory.name}
			</h2>

			<div class="mt-3 rounded-lg border border-border p-4">
				<div class="text-sm text-muted"><Markdown text={inventory.outfit.text} /></div>
				<ul class="mt-2 space-y-1 text-sm">
					{#each inventory.outfit.loads as load (load.name)}
						<li>
							<span class="font-medium capitalize">{load.name}</span>
							<span class="text-muted"> — {load.marks} ◇</span>
							{#if load.tags?.length}
								<span class="text-xs text-muted italic">({load.tags.join(', ')})</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<h3 class="mt-6 text-lg font-semibold">Gear</h3>
			<ul class="mt-2 divide-y divide-border rounded-md border border-border text-sm">
				{#each inventory.gear as item (item.name)}
					<li class="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5">
						<span class="font-medium">{item.name}</span>
						<span class="text-xs text-muted">{'◇'.repeat(item.slots)}</span>
						{#if item.uses}<span class="text-xs text-muted">uses: {item.uses}</span>{/if}
						{#if item.tags?.length}
							<span class="text-xs text-muted italic">{item.tags.join(', ')}</span>
						{/if}
						{#if item.text}<span class="text-xs text-muted">{item.text}</span>{/if}
						{#if item.note}<span class="text-xs text-muted">{item.note}</span>{/if}
						{#if item.ammo?.length}
							<span class="text-xs text-muted">ammo: {item.ammo.join(' / ')}</span>
						{/if}
					</li>
				{/each}
			</ul>

			<h3 class="mt-6 text-lg font-semibold">Small items</h3>
			<div class="mt-1 text-sm text-muted"><Markdown text={inventory.smallItems.text} /></div>
			<ul class="mt-2 divide-y divide-border rounded-md border border-border text-sm">
				{#each smallOptions as item (item.name)}
					<li class="flex flex-wrap items-baseline gap-x-2 px-3 py-1.5">
						<span class="font-medium">{item.name}</span>
						{#if item.uses}<span class="text-xs text-muted">uses: {item.uses}</span>{/if}
						{#if item.tags?.length}
							<span class="text-xs text-muted italic">{item.tags.join(', ')}</span>
						{/if}
						{#if item.text}<span class="text-xs text-muted">{item.text}</span>{/if}
						{#if item.ammo?.length}
							<span class="text-xs text-muted">ammo: {item.ammo.join(' / ')}</span>
						{/if}
					</li>
				{/each}
			</ul>

			<h3 class="mt-6 text-lg font-semibold">Prosperity</h3>
			<ul class="mt-2 space-y-1 text-sm">
				{#each inventory.prosperity as step (step.value)}
					<li>
						<span class="font-mono font-medium"
							>{step.value >= 0 ? `+${step.value}` : step.value}</span
						>
						{#if step.note}<span class="text-muted">
								— <Markdown text={step.note} inline /></span
							>{/if}
					</li>
				{/each}
			</ul>
		</section>
	</div>
{/if}
