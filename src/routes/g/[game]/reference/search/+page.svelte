<script lang="ts">
	import type MiniSearch from 'minisearch';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { loadSearchIndex, search } from '$lib/reference/search';

	let { data } = $props();

	let query = $state(page.url.searchParams.get('q') ?? '');
	let index = $state<MiniSearch | null>(null);
	let loadError = $state<string | null>(null);

	// Load the prebuilt index once, in the browser only.
	$effect(() => {
		let alive = true;
		loadSearchIndex(data.gameId, fetch)
			.then((i) => alive && (index = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	const results = $derived(index ? search(index, query) : []);

	// Keep ?q= in the URL so a search is shareable and survives reload.
	$effect(() => {
		if (!browser) return;
		const url = new URL(page.url);
		if (query) url.searchParams.set('q', query);
		else url.searchParams.delete('q');
		// Same-document query-string update (shareable ?q=), not a route change,
		// so resolve() doesn't apply — the URL is derived from the current one.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		if (url.href !== page.url.href) replaceState(url, page.state);
	});

	const href = (id: string) =>
		resolve('/g/[game]/reference/[section]', { game: data.gameId, section: id });
</script>

<svelte:head>
	<title>Search — {data.gameName} rules</title>
</svelte:head>

<h1 class="text-2xl font-bold tracking-tight">Search the rules</h1>

<form class="mt-4" onsubmit={(e) => e.preventDefault()}>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		bind:value={query}
		type="search"
		autofocus
		placeholder="Search {data.gameName}…"
		aria-label="Search the rules"
		class="w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
	/>
</form>

{#if loadError}
	<p class="mt-6 text-muted">Couldn’t load the search index: {loadError}</p>
{:else if !index}
	<p class="mt-6 text-muted">Loading search…</p>
{:else if !query.trim()}
	<p class="mt-6 text-muted">Type to search titles and rules text across {data.gameName}.</p>
{:else if results.length === 0}
	<p class="mt-6 text-muted">No matches for “{query}”.</p>
{:else}
	<p class="mt-6 text-sm text-muted">
		{results.length}{results.length === 40 ? '+' : ''} result{results.length === 1 ? '' : 's'}
	</p>
	<ul class="mt-2 divide-y divide-border">
		{#each results as hit (hit.id)}
			<li class="py-3">
				<a href={href(hit.id)} class="block hover:text-accent">
					<span class="font-medium">{hit.title}</span>
					{#if hit.breadcrumb !== hit.title}
						<span class="ml-2 text-xs text-muted">{hit.breadcrumb}</span>
					{/if}
				</a>
				{#if hit.excerpt}
					<p class="mt-1 line-clamp-2 text-sm text-muted">{hit.excerpt}</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
