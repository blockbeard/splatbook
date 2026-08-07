<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.gameName}</title>
</svelte:head>

<section class="mx-auto max-w-2xl py-12 text-center">
	{#if data.landing?.image}
		<img
			src={data.landing.image.src}
			alt={data.landing.image.alt}
			class="mx-auto mb-6 h-40 w-auto"
		/>
	{/if}
	<h1 class="text-4xl font-bold tracking-tight">{data.gameName}</h1>
	<p class="mt-4 text-lg text-muted">
		{#if data.landing}
			{data.landing.tagline}
		{:else if data.creators.length}
			Build a character, look a rule up, run a table — everything for {data.gameName} lives here.
		{:else}
			Look a rule up — the {data.gameName} reference lives here.
		{/if}
	</p>
	{#if data.landing?.blurb}
		<p class="mx-auto mt-3 max-w-xl text-muted">{data.landing.blurb}</p>
	{/if}
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
		     to sign in rather than turning you away. Reference-only games have
		     nothing for a campaign to do, so they don't offer one. -->
		{#if data.hasCampaigns}
			<a
				href={resolve('/campaigns')}
				class="inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface"
			>
				Campaigns
			</a>
		{/if}
	</div>
	{#if data.landing && data.landing.links.length > 0}
		<div class="mt-10 border-t border-border pt-6">
			<ul class="flex flex-wrap items-start justify-center gap-x-8 gap-y-3">
				{#each data.landing.links as link (link.url)}
					<li class="max-w-56 text-sm">
						<a
							href={link.url}
							target="_blank"
							rel="noopener external"
							class="font-medium text-accent hover:underline"
						>
							{link.label} ↗
						</a>
						{#if link.note}
							<p class="mt-1 text-xs text-muted">{link.note}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
