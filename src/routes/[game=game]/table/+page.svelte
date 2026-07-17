<!--
	Table reference route — generic shell around the game's own handout page
	(commit 113). The shell supplies the back link and the title; the game's
	component fetches its own pack data and renders the rest.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { getGame } from '$lib/games';

	let { data } = $props();

	const Reference = $derived(getGame(data.gameId)?.tableReference?.component ?? null);
</script>

<svelte:head>
	<title>{data.label} — {data.gameName}</title>
</svelte:head>

<div class="mb-6">
	<a
		href={resolve('/[game=game]', { game: data.gameId })}
		class="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
	>
		← {data.gameName}
	</a>
</div>

{#if Reference}
	<Reference />
{/if}
