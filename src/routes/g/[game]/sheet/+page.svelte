<!--
	Character sheet view — generic shell. Loads the autosaved draft from the same
	localStorage slot the builder writes, and renders the game's sheet component
	from the registry. A toolbar (hidden when printing) offers print and a link
	back to the builder. Print CSS drops the site chrome so the sheet prints clean.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';
	import { draftKey, loadDraft } from '$lib/wizard';

	let { data } = $props();

	const game = $derived(getGame(data.gameId)!);
	const Sheet = $derived(game.sheetComponent!);
	// A saved entity (loaded by `?id=`) wins; otherwise read the local autosave.
	const character = $derived(
		data.saved?.data ??
			(browser
				? loadDraft<object>(localStorage, draftKey(data.gameId, 'character', 'current'))
				: null)
	);
</script>

<svelte:head>
	<title>Character sheet — {data.gameName}</title>
</svelte:head>

<div class="sheet-toolbar mb-6 flex items-center justify-between">
	<a
		href={resolve('/g/[game]/build', { game: data.gameId })}
		class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
	>
		← Back to builder
	</a>
	<button
		type="button"
		onclick={() => window.print()}
		class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90"
	>
		Print
	</button>
</div>

{#if !character}
	<p class="text-muted">
		No character in progress. <a
			href={resolve('/g/[game]/build', { game: data.gameId })}
			class="text-accent hover:underline">Start building one.</a
		>
	</p>
{:else}
	<Sheet {character} />
{/if}

<style>
	@media print {
		.sheet-toolbar {
			display: none;
		}
		/* Drop the app chrome so only the sheet prints. */
		:global(body > div > header),
		:global(body > div > footer) {
			display: none;
		}
	}
</style>
