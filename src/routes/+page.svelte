<script lang="ts">
	import { resolve } from '$app/paths';
	import { signIn } from '@auth/sveltekit/client';
	import { APP_NAME } from '$lib';
	import { listGames } from '$lib/games';

	let { data } = $props();

	/**
	 * The front door is game-agnostic: every registered module gets a card, and
	 * what goes on it is read off the registry rather than listed here.
	 *
	 * That last part is the point. This page used to name three of the six things
	 * a game can offer, by an unwritten rule, and the rule went stale twice
	 * without anyone noticing — the table reference was missing from the day it
	 * shipped, and so was the card table. A slot added to `GameModule` now shows
	 * up here on its own.
	 */
	const games = listGames().map((game) => {
		const creators = Object.entries(game.entityTypes ?? {})
			.filter(([, type]) => type.newDraft)
			.map(([entityType, type]) => ({
				entityType,
				label: type.label,
				via: type.wizardSteps?.length ? ('build' as const) : ('play' as const)
			}));
		return {
			id: game.id,
			name: game.name,
			creators,
			/**
			 * The one thing this game most wants a stranger to do. A game you can
			 * build a character for opens with that; a reference-only game opens
			 * with the book. Everything else on the card is a quiet link, so two
			 * games' worth of tools stays a front door rather than a wall of
			 * twelve equal buttons.
			 */
			primary: creators.length
				? {
						href: creators[0].via === 'build' ? 'build' : 'play',
						entityType: creators[0].entityType,
						label: `Build a ${creators[0].label.toLowerCase()}`
					}
				: null,
			tableReferenceLabel: game.tableReference?.label ?? null,
			hasCardTable: !!game.cardTable,
			hasGmGuide: !!game.gmGuide
		};
	});

	const signedIn = $derived(!!data.session?.user);
</script>

<svelte:head>
	<title>{APP_NAME}</title>
	<meta
		name="description"
		content="Character builders, campaign trackers, searchable rules and a shared card table for the tabletop games you actually play."
	/>
</svelte:head>

<section class="mx-auto max-w-3xl py-12">
	<div class="text-center">
		<h1 class="text-4xl font-bold tracking-tight">
			{APP_NAME}<span class="text-accent">*</span>
		</h1>
		<p class="mt-4 text-lg text-muted">
			Character builders, campaign trackers, searchable rules and a shared card table — for the
			games you actually play.
		</p>
	</div>

	{#each games as game (game.id)}
		<article class="mt-10 rounded-lg border border-border bg-surface p-6">
			<h2 class="text-2xl font-semibold tracking-tight">
				<a href={resolve('/[game=game]', { game: game.id })} class="hover:text-accent"
					>{game.name}</a
				>
			</h2>
			<div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
				{#if game.primary}
					<a
						href={game.primary.href === 'build'
							? resolve('/[game=game]/[type]/build', {
									game: game.id,
									type: game.primary.entityType
								})
							: resolve('/[game=game]/[type]/play', {
									game: game.id,
									type: game.primary.entityType
								})}
						class="rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90"
					>
						{game.primary.label}
					</a>
				{:else}
					<!-- Nothing to build: the book itself is what this game opens with. -->
					<a
						href={resolve('/[game=game]/reference', { game: game.id })}
						class="rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90"
					>
						Open the reference
					</a>
				{/if}

				<!-- Everything else the game has, quietly. -->
				{#each game.creators.slice(1) as creator (creator.entityType)}
					<a
						href={creator.via === 'build'
							? resolve('/[game=game]/[type]/build', { game: game.id, type: creator.entityType })
							: resolve('/[game=game]/[type]/play', { game: game.id, type: creator.entityType })}
						class="underline hover:text-accent">Build a {creator.label.toLowerCase()}</a
					>
				{/each}
				{#if game.primary}
					<a
						href={resolve('/[game=game]/reference', { game: game.id })}
						class="underline hover:text-accent">Rules reference</a
					>
				{/if}
				{#if game.tableReferenceLabel}
					<a
						href={resolve('/[game=game]/table', { game: game.id })}
						class="underline hover:text-accent">{game.tableReferenceLabel}</a
					>
				{/if}
				{#if game.hasCardTable}
					<a
						href={resolve('/[game=game]/cards', { game: game.id })}
						class="underline hover:text-accent">Card table</a
					>
				{/if}
				{#if game.hasGmGuide}
					<a
						href={resolve('/[game=game]/gm', { game: game.id })}
						class="underline hover:text-accent">GM guide</a
					>
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
