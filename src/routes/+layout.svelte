<script lang="ts">
	import '../app.css';
	import { browser, dev } from '$app/environment';
	import { resolve } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import favicon from '$lib/assets/favicon.svg';
	import { APP_NAME, APP_REPO_URL } from '$lib';
	import { listGames } from '$lib/games';
	import { migrateLocalDrafts } from '$lib/entities/client';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import AuthControl from '$lib/components/AuthControl.svelte';

	let { children, data } = $props();

	// With a single game registered there is nothing to pick — the shell
	// shows a direct link and the picker stays hidden until game #2 exists.
	const games = listGames();

	// Cloudflare Web Analytics (commit 116): cookieless page counts, nothing
	// stored about the visitor, no consent banner needed — which is exactly the
	// claim /privacy makes, so if this ever grows into something that tracks,
	// that page changes in the same commit. Config, not code: the beacon only
	// renders when a deployment sets PUBLIC_CF_BEACON_TOKEN (production), never
	// in dev. If event-level questions arise later ("does anyone use the PDF
	// export?"), self-hosted Umami on atlas is the upgrade path that keeps the
	// no-third-party-tracking claim true.
	const beaconToken = dev ? undefined : env.PUBLIC_CF_BEACON_TOKEN;

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
	{#if beaconToken}
		<script
			defer
			src="https://static.cloudflareinsights.com/beacon.min.js"
			data-cf-beacon={JSON.stringify({ token: beaconToken })}
		></script>
	{/if}
</svelte:head>

<div class="flex min-h-screen flex-col bg-bg text-text">
	<header class="app-chrome border-b border-border bg-surface">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<a href={resolve('/')} class="text-lg font-semibold tracking-tight">
				{APP_NAME}<span class="text-accent">*</span>
			</a>
			<nav class="flex items-center gap-4 text-sm text-muted">
				{#each games as game (game.id)}
					<a href={resolve('/[game=game]', { game: game.id })} class="hover:text-text">
						{game.name}
					</a>
				{/each}
				{#if data.session?.user}
					<a href={resolve('/dashboard')} class="hover:text-text">Characters</a>
					<a href={resolve('/campaigns')} class="hover:text-text">Campaigns</a>
				{/if}
				<ThemeToggle />
				<AuthControl />
			</nav>
		</div>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
		{@render children()}
	</main>

	<footer class="app-chrome border-t border-border bg-surface">
		<div class="mx-auto max-w-5xl px-4 py-4 text-xs text-muted">
			<p>
				Splatbook is free software under the
				<a href="https://www.gnu.org/licenses/gpl-3.0.html" class="underline hover:text-text"
					>GPL-3.0-or-later</a
				>. Game text belongs to its respective publishers — see
				<a href={resolve('/credits')} class="underline hover:text-text">credits &amp; licensing</a>.
				<span aria-hidden="true">·</span>
				<a href="{resolve('/credits')}#support" class="underline hover:text-text">Support</a>
				<span aria-hidden="true">·</span>
				<a href={resolve('/privacy')} class="underline hover:text-text">Privacy</a>
				<span aria-hidden="true">·</span>
				<a href={resolve('/terms')} class="underline hover:text-text">Terms</a>
				<span aria-hidden="true">·</span>
				<!-- Feedback goes where the fix happens (commit 116). -->
				<a href="{APP_REPO_URL}/issues" rel="external" class="underline hover:text-text">
					Feedback
				</a>
			</p>
		</div>
	</footer>
</div>
