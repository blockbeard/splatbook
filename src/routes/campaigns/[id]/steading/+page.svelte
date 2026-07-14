<!--
	Campaign steading — shared view. Renders the game's steading sheet read-only
	for every member; the owner also gets an Edit link to the normal editor (which
	autosaves to the same entity). Print CSS drops the app chrome, like the entity
	sheet route.
-->
<script lang="ts">
	import { printSheet } from '$lib/print';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';

	let { data } = $props();

	const Sheet = $derived(getGame(data.campaign.gameId)?.entityTypes['steading']?.sheetComponent);
	const editHref = $derived(
		data.steading
			? `${resolve('/[game=game]/[type]/play', { game: data.campaign.gameId, type: 'steading' })}?id=${data.steading.id}`
			: null
	);
	const backHref = $derived(resolve('/campaigns/[id]', { id: data.campaign.id }));
</script>

<svelte:head>
	<title>Steading — {data.campaign.name}</title>
</svelte:head>

<div class="sheet-toolbar mb-6 flex items-center justify-between">
	<a
		href={backHref}
		class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
	>
		← {data.campaign.name}
	</a>
	<div class="flex items-center gap-2">
		{#if data.steading?.canEdit && editHref}
			<!-- Not "Edit": it's the steading's play sheet — where you tap its stats,
			     turn the season and roll its moves. Calling it Edit hid it. -->
			<a
				href={editHref}
				class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90"
			>
				Open tracker
			</a>
		{/if}
		{#if data.steading}
			<button
				type="button"
				onclick={() => printSheet()}
				class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90"
			>
				Print
			</button>
		{/if}
	</div>
</div>

{#if !data.steading}
	<p class="text-muted">
		This campaign has no steading yet.
		{#if data.isGm}
			<a href={backHref} class="text-accent hover:underline">Create one.</a>
		{/if}
	</p>
{:else if Sheet}
	<!-- The blob is opaque to the shell; the game's own sheet component parses it. -->
	<Sheet character={data.steading.data as object} />
{:else}
	<p class="text-muted">This game has no steading sheet.</p>
{/if}

<style>
	@media print {
		.sheet-toolbar {
			display: none;
		}
		:global(body > div > header),
		:global(body > div > footer) {
			display: none;
		}
	}
</style>
