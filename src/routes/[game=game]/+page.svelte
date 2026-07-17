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
		Build a character, look a rule up, run a table — everything for {data.gameName} lives here.
	</p>
	<div class="mt-8 flex flex-wrap justify-center gap-3">
		{#each data.creators as creator, i (creator.entityType)}
			<a
				href={creator.via === 'build'
					? resolve('/[game=game]/[type]/build', { game: data.gameId, type: creator.entityType })
					: resolve('/[game=game]/[type]/play', { game: data.gameId, type: creator.entityType })}
				class={i === 0
					? 'inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90'
					: 'inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface'}
			>
				Create a {creator.label.toLowerCase()}
			</a>
		{/each}
		<a
			href={resolve('/[game=game]/reference', { game: data.gameId })}
			class="inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface"
		>
			Rules reference
		</a>
		{#if data.tableReferenceLabel}
			<a
				href={resolve('/[game=game]/table', { game: data.gameId })}
				class="inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface"
			>
				{data.tableReferenceLabel}
			</a>
		{/if}
		{#if data.hasGmGuide}
			<a
				href={resolve('/[game=game]/gm', { game: data.gameId })}
				class="inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface"
			>
				GM guide
			</a>
		{/if}
		<!-- Campaigns are cross-game and live outside /[game], but the game's front
		     door is where you look for them. Signed out, the campaigns page prompts
		     to sign in rather than turning you away. -->
		<a
			href={resolve('/campaigns')}
			class="inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface"
		>
			Campaigns
		</a>
	</div>
</section>
