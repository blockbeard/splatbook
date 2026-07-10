<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.gameName}</title>
</svelte:head>

<section class="mx-auto max-w-2xl py-12 text-center">
	<h1 class="text-4xl font-bold tracking-tight">{data.gameName}</h1>
	<p class="mt-4 text-lg text-muted">
		The home of {data.gameName} — reference, character builder, and campaign tools land here as their
		phases arrive.
	</p>
	<div class="mt-8 flex flex-wrap justify-center gap-3">
		{#each data.creators as creator, i (creator.entityType)}
			<a
				href={creator.via === 'build'
					? resolve('/g/[game]/[type]/build', { game: data.gameId, type: creator.entityType })
					: resolve('/g/[game]/[type]/play', { game: data.gameId, type: creator.entityType })}
				class={i === 0
					? 'inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90'
					: 'inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface'}
			>
				Create a {creator.label.toLowerCase()}
			</a>
		{/each}
		<a
			href={resolve('/g/[game]/reference', { game: data.gameId })}
			class="inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface"
		>
			Rules reference
		</a>
		{#if data.hasGmGuide}
			<a
				href={resolve('/g/[game]/gm', { game: data.gameId })}
				class="inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface"
			>
				GM guide
			</a>
		{/if}
	</div>
</section>
