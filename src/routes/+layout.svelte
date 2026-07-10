<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { APP_NAME } from '$lib';
	import { listGames } from '$lib/games';
	import { migrateLocalDrafts } from '$lib/entities/client';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import AuthControl from '$lib/components/AuthControl.svelte';

	let { children, data } = $props();

	// With a single game registered there is nothing to pick — the shell
	// shows a direct link and the picker stays hidden until game #2 exists.
	const games = listGames();

	// On sign-in, push any drafts built while logged out up to the database
	// (once per account, best-effort). See $lib/entities/client.
	let migratedFor = $state<string | null>(null);
	$effect(() => {
		const uid = data.session?.user?.id;
		if (!browser || !uid || migratedFor === uid) return;
		migratedFor = uid;
		void migrateLocalDrafts(localStorage);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col bg-bg text-text">
	<header class="border-b border-border bg-surface">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<a href={resolve('/')} class="text-lg font-semibold tracking-tight">
				{APP_NAME}<span class="text-accent">*</span>
			</a>
			<nav class="flex items-center gap-4 text-sm text-muted">
				{#each games as game (game.id)}
					<a href={resolve('/g/[game]', { game: game.id })} class="hover:text-text">
						{game.name}
					</a>
				{/each}
				{#if data.session?.user}
					<a href={resolve('/dashboard')} class="hover:text-text">Characters</a>
				{/if}
				<ThemeToggle />
				<AuthControl />
			</nav>
		</div>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
		{@render children()}
	</main>

	<footer class="border-t border-border bg-surface">
		<div class="mx-auto max-w-5xl px-4 py-4 text-xs text-muted">
			<p>
				Splatbook is free software under the
				<a href="https://www.gnu.org/licenses/gpl-3.0.html" class="underline hover:text-text"
					>GPL-3.0-or-later</a
				>. Game text belongs to its respective publishers — see per-game credits.
			</p>
		</div>
	</footer>
</div>
