<script lang="ts">
	import { resolve } from '$app/paths';
	import { signIn } from '@auth/sveltekit/client';
	import { APP_NAME } from '$lib';
	import { listGames } from '$lib/games';

	let { data } = $props();

	// The front door is game-agnostic: every registered module gets a card, with
	// its own creatable entity types read off the registry. Today that's one card.
	const games = listGames().map((game) => ({
		id: game.id,
		name: game.name,
		creators: Object.entries(game.entityTypes)
			.filter(([, type]) => type.newDraft)
			.map(([entityType, type]) => ({
				entityType,
				label: type.label,
				via: type.wizardSteps?.length ? ('build' as const) : ('play' as const)
			})),
		hasGmGuide: !!game.gmGuide
	}));

	const signedIn = $derived(!!data.session?.user);
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta
		name="description"
		content="Character builders, campaign trackers, and searchable rules for the tabletop games you actually play."
	/>
</svelte:head>

<section class="mx-auto max-w-3xl py-12">
	<div class="text-center">
		<h1 class="text-4xl font-bold tracking-tight">
			{APP_NAME}<span class="text-accent">*</span>
		</h1>
		<p class="mt-4 text-lg text-muted">
			Character builders, campaign trackers, and searchable rules — for the games you actually play.
		</p>
	</div>

	{#each games as game (game.id)}
		<article class="mt-10 rounded-lg border border-border bg-surface p-6">
			<h2 class="text-2xl font-semibold tracking-tight">
				<a href={resolve('/g/[game]', { game: game.id })} class="hover:text-accent">{game.name}</a>
			</h2>
			<div class="mt-5 flex flex-wrap gap-3">
				{#each game.creators as creator, i (creator.entityType)}
					<a
						href={creator.via === 'build'
							? resolve('/g/[game]/[type]/build', { game: game.id, type: creator.entityType })
							: resolve('/g/[game]/[type]/play', { game: game.id, type: creator.entityType })}
						class={i === 0
							? 'rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90'
							: 'rounded-md border border-border px-4 py-2 font-medium hover:bg-bg'}
					>
						Build a {creator.label.toLowerCase()}
					</a>
				{/each}
				<a
					href={resolve('/g/[game]/reference', { game: game.id })}
					class="rounded-md border border-border px-4 py-2 font-medium hover:bg-bg"
				>
					Open the reference
				</a>
				{#if game.hasGmGuide}
					<a
						href={resolve('/g/[game]/gm', { game: game.id })}
						class="rounded-md border border-border px-4 py-2 font-medium hover:bg-bg"
					>
						Run the game
					</a>
				{/if}
			</div>
		</article>
	{/each}

	<p class="mt-8 text-center text-sm text-muted">
		{#if signedIn}
			<a href={resolve('/dashboard')} class="underline hover:text-text">Your characters</a>
			<span aria-hidden="true">·</span>
			<a href={resolve('/campaigns')} class="underline hover:text-text">your campaigns</a>
		{:else}
			<button type="button" onclick={() => signIn()} class="underline hover:text-text">
				Sign in
			</button>
			to save characters, run a campaign, and roll with your table. You can build a character without
			an account — it's kept in this browser until you do.
		{/if}
	</p>

	<p class="mt-10 border-t border-border pt-6 text-center text-xs text-muted">
		{APP_NAME} is a game-agnostic framework for tabletop companion apps: everything above is driven by
		a per-game content pack, so a new game is a pack and a module, not a rewrite.
		<a href={resolve('/credits')} class="underline hover:text-text">Credits &amp; licensing</a>.
	</p>
</section>
