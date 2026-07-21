<script lang="ts">
	import type MiniSearch from 'minisearch';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { loadSearchIndex, loadGmSearchIndex, search, mergeHits } from '$lib/reference/search';
	import { queryTerms, highlight, makeSnippet } from '$lib/reference/snippet';

	let { data } = $props();

	let query = $state(page.url.searchParams.get('q') ?? '');
	let debounced = $state(page.url.searchParams.get('q') ?? '');
	let index = $state<MiniSearch | null>(null);
	// GM-only index, loaded only when the reader has opted into spoilers. The
	// opt-in checkbox itself lives in the reference sidebar now (SpoilerToggle
	// — one home, visible from the TOC too); this page just reacts to
	// `data.showSetting`, so toggling reruns the search live: dropping or
	// loading the gated index re-derives `results` below.
	let gmIndex = $state<MiniSearch | null>(null);
	let loadError = $state<string | null>(null);
	let expanded = $state<Record<string, boolean>>({});

	const badge = $derived(data.spoilers?.badge ?? 'GM');

	// Load the prebuilt index once, in the browser only.
	$effect(() => {
		let alive = true;
		loadSearchIndex(data.gameId, fetch)
			.then((i) => alive && (index = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		return () => (alive = false);
	});

	// The opted-in reader additionally searches Book II. Unlike the old GM
	// gate, this can now flip off mid-session (the reader unchecks the box),
	// so the branch has to actively drop the index rather than just skip
	// reloading it — otherwise gated hits would linger in results after
	// opting back out.
	$effect(() => {
		if (!data.showSetting) {
			gmIndex = null;
			return;
		}
		let alive = true;
		loadGmSearchIndex(data.gameId, fetch)
			.then((i) => alive && (gmIndex = i))
			.catch(() => {}); // Additive; failing to load it just omits gated results
		return () => (alive = false);
	});

	// Debounce keystrokes (matches the reference tool's feel) and reset expansions.
	$effect(() => {
		const q = query;
		const t = setTimeout(() => {
			debounced = q;
			expanded = {};
		}, 120);
		return () => clearTimeout(t);
	});

	const terms = $derived(queryTerms(debounced));
	const results = $derived(
		index ? mergeHits(search(index, debounced), gmIndex ? search(gmIndex, debounced) : []) : []
	);

	// Keep ?q= in the URL so a search is shareable and survives reload.
	$effect(() => {
		if (!browser) return;
		// Compare *param values* against `location`, never hrefs against
		// `page.url`, for two hard-won reasons. (1) The load-time URL may
		// encode a space as %20 while URLSearchParams serialises it as +, so
		// an href comparison can differ on mount even though the query is
		// unchanged — and calling `replaceState` while this effect first runs,
		// during hydration, is before kit's router has initialised: in dev
		// that's the "Cannot call replaceState(...) before router is
		// initialized" error, in prod the guard is compiled out and it crashes
		// the client mid-start, wedging every later shallow-routing and
		// `invalidate` call on the page. (2) `page.url` deliberately never
		// updates on shallow routing, so it goes stale after our own first
		// write; `location` is always current.
		const current = new URLSearchParams(location.search).get('q') ?? '';
		if (debounced === current) return;
		const url = new URL(location.href);
		if (debounced) url.searchParams.set('q', debounced);
		else url.searchParams.delete('q');
		// Same-document query-string update (shareable ?q=), not a route change.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(url, page.state);
	});

	const href = (id: string) =>
		resolve('/[game=game]/reference/[section]', { game: data.gameId, section: id });
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
{:else if !debounced.trim()}
	<p class="mt-6 text-muted">Type to search titles and rules text across {data.gameName}.</p>
{:else if results.length === 0}
	<p class="mt-6 text-muted">No matches for “{debounced}”.</p>
{:else}
	<p class="mt-6 text-sm text-muted">
		{results.length}{results.length === 40 ? '+' : ''} result{results.length === 1 ? '' : 's'}
	</p>
	<ul class="mt-2 divide-y divide-border" aria-label="Search results">
		{#each results as hit (hit.id)}
			{@const snip = makeSnippet(hit.body, terms)}
			{@const isOpen = expanded[hit.id]}
			{@const hasMore = snip.full.length > snip.short.length}
			<li class="py-3">
				<a href={href(hit.id)} class="block hover:text-accent">
					<span class="font-medium">{hit.title}</span>
					{#if hit.visibility === 'gm'}
						<span
							class="ml-2 rounded border border-accent px-1 py-0.5 text-[10px] tracking-wide text-accent uppercase"
						>
							{badge}
						</span>
					{/if}
					{#if hit.breadcrumb !== hit.title}
						<span class="ml-2 text-xs text-muted">{hit.breadcrumb}</span>
					{/if}
				</a>
				{#if hit.body}
					<p class="reference-snippet mt-1 text-sm text-muted">
						<!-- Trusted: HTML-escaped body with <mark> highlights (snippet.ts). -->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html highlight(isOpen ? snip.full : snip.short, terms)}
						{#if hasMore && !isOpen}
							<button
								type="button"
								class="ml-1 text-accent hover:underline"
								onclick={() => (expanded = { ...expanded, [hit.id]: true })}
							>
								more
							</button>
						{/if}
					</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.reference-snippet :global(mark) {
		background-color: color-mix(in oklab, var(--sb-accent) 28%, transparent);
		color: inherit;
		border-radius: 2px;
		padding: 0 1px;
	}
</style>
