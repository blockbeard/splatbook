<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	/**
	 * The row's first action carries the solid treatment; the rest are outlines.
	 * It used to be hard-coded to the first *creator*, which meant a game with no
	 * creators had no primary action at all — on HMtW, whose only door is "Rules
	 * reference", the single call to action on the page rendered as a hairline
	 * outline (`--sb-border` is 18%-opacity ink on white) and was the quietest
	 * thing on the screen. Its own theme says buttons should read "as solid black
	 * — the book's poster look".
	 */
	const PRIMARY =
		'inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90';
	const SECONDARY =
		'inline-block rounded-md border border-border px-4 py-2 font-medium hover:bg-surface';
	/** True when a creator already took the solid treatment above. */
	const hasCreators = $derived(data.creators.length > 0);
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
				class={i === 0 ? PRIMARY : SECONDARY}
			>
				Create a {creator.label.toLowerCase()}
			</a>
		{/each}
		<a
			href={resolve('/[game=game]/reference', { game: data.gameId })}
			class={hasCreators ? SECONDARY : PRIMARY}
		>
			Rules reference
		</a>
		{#if data.tableReferenceLabel}
			<a href={resolve('/[game=game]/table', { game: data.gameId })} class={SECONDARY}>
				{data.tableReferenceLabel}
			</a>
		{/if}
		{#if data.hasGmGuide}
			<a href={resolve('/[game=game]/gm', { game: data.gameId })} class={SECONDARY}> GM guide </a>
		{/if}
		<!-- Campaigns are cross-game and live outside /[game], but the game's front
		     door is where you look for them. Signed out, the campaigns page prompts
		     to sign in rather than turning you away. Reference-only games have
		     nothing for a campaign to do, so they don't offer one. -->
		{#if data.hasCampaigns}
			<a href={resolve('/campaigns')} class={SECONDARY}> Campaigns </a>
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
