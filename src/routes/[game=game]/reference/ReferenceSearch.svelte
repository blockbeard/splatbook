<!--
	Live rules search — one implementation, two hosts (phase 25): the search page,
	and the mobile bar's panel. Everything reader-visible about searching lives
	here, so the debounce feel, the index gating, the pinned-terms strip and the
	snippet rendering can't drift between them.

	`variant`:
	- 'page'  — the /reference/search route. Loads eagerly (you navigated here on
	            purpose) and owns `?q=` in the URL so a search is shareable.
	- 'panel' — the bar's dropdown. Loads on first use, never writes the URL, and
	            carries the spoiler toggle: opting in is what selects the GM index,
	            so it belongs to the query surface. The <input> is the bar's own —
	            the panel opens *around* it rather than mounting a second one,
	            because moving focus to a new input makes iOS dismiss and re-raise
	            the soft keyboard on every search.
-->
<script lang="ts">
	import type MiniSearch from 'minisearch';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		loadSearchIndex,
		loadGmSearchIndex,
		loadPinnedTerms,
		search,
		mergeHits
	} from '$lib/reference/search';
	import { matchPinnedTerms, mergePinnedTerms, type PinnedTerm } from '$lib/reference/pinned';
	import { queryTerms, highlight, makeSnippet } from '$lib/reference/snippet';

	let {
		gameId,
		gameName,
		showSetting,
		badge = 'GM',
		variant = 'page',
		/** Bound so a host can clear or read the query (the panel closes on empty). */
		query = $bindable(''),
		/** 'panel' defers loading until the reader actually opens it. */
		active = true,
		/** Rendered above the results — the panel puts the spoiler toggle here. */
		controls
	}: {
		gameId: string;
		gameName: string;
		showSetting: boolean;
		badge?: string;
		variant?: 'page' | 'panel';
		query?: string;
		active?: boolean;
		controls?: Snippet;
	} = $props();

	let debounced = $state(query);
	let index = $state<MiniSearch | null>(null);
	// GM-only index, loaded only when the reader has opted into spoilers. Toggling
	// reruns the search live: dropping or loading the gated index re-derives
	// `results` below.
	let gmIndex = $state<MiniSearch | null>(null);
	// Curated pinned terms (phase 22): the player artifact loads whenever the
	// game ships one (404 → null → no pinned UI at all); the GM artifact is
	// gated behind the spoiler opt-in exactly like the GM search index — the
	// term labels are themselves the spoiler, which is why the split happened
	// at build time.
	let pinned = $state<PinnedTerm[] | null>(null);
	let gmPinned = $state<PinnedTerm[] | null>(null);
	let loadError = $state<string | null>(null);
	let expanded = $state<Record<string, boolean>>({});

	// Load the prebuilt index once, in the browser only. The loaders memoise per
	// game (search.ts), so a panel that opens and closes all day fetches and
	// parses the artifact once.
	$effect(() => {
		if (!active) return;
		let alive = true;
		loadSearchIndex(gameId, fetch)
			.then((i) => alive && (index = i))
			.catch((e) => alive && (loadError = e instanceof Error ? e.message : String(e)));
		loadPinnedTerms(gameId, fetch)
			.then((t) => alive && (pinned = t))
			.catch(() => {}); // Additive; failing to load just omits the pinned block
		return () => (alive = false);
	});

	// The opted-in reader additionally searches Book II. Unlike the old GM
	// gate, this can now flip off mid-session (the reader unchecks the box),
	// so the branch has to actively drop the index rather than just skip
	// reloading it — otherwise gated hits would linger in results after
	// opting back out.
	$effect(() => {
		if (!active || !showSetting) {
			gmIndex = null;
			gmPinned = null;
			return;
		}
		let alive = true;
		loadGmSearchIndex(gameId, fetch)
			.then((i) => alive && (gmIndex = i))
			.catch(() => {}); // Additive; failing to load it just omits gated results
		loadPinnedTerms(gameId, fetch, { gm: true })
			.then((t) => alive && (gmPinned = t))
			.catch(() => {});
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
	const pinnedMatches = $derived(matchPinnedTerms(mergePinnedTerms(pinned, gmPinned), debounced));

	// Keep ?q= in the URL so a search is shareable and survives reload. The panel
	// never does this: it isn't a route, and a dropdown rewriting the address bar
	// of the page behind it would make Back mean something the reader didn't ask
	// for.
	$effect(() => {
		if (variant !== 'page' || !browser) return;
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
		resolve('/[game=game]/reference/[section]', { game: gameId, section: id });

	const searchHref = $derived(
		resolve('/[game=game]/reference/search', { game: gameId }) +
			(debounced.trim() ? `?q=${encodeURIComponent(debounced)}` : '')
	);
</script>

{#if variant === 'page'}
	<!-- svelte-ignore a11y_autofocus -->
	<form class="mt-4" onsubmit={(e) => e.preventDefault()}>
		<input
			bind:value={query}
			type="search"
			autofocus
			placeholder="Search {gameName}…"
			aria-label="Search the rules"
			class="w-full rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
		/>
	</form>
{/if}

{@render controls?.()}

{#if debounced.trim() && pinnedMatches.length > 0}
	<!-- Curated index entries, pinned above the fuzzy hits (phase 22). On the
	     panel these land first while the index is still in flight — the terms
	     artifact is a fiftieth of its size. -->
	<div class="mt-4 rounded-md border border-accent/40 bg-surface p-3" data-testid="pinned-terms">
		<p class="text-xs tracking-wide text-muted uppercase">From the index</p>
		<ul class="mt-1 space-y-1">
			{#each pinnedMatches as pin (pin.term)}
				<li class="text-sm">
					<span class="font-medium">{pin.term}</span>
					<span class="text-muted">—</span>
					{#each pin.targets as target, i (target.url ?? target.id)}
						{#if i > 0}<span class="text-muted">·</span>{/if}
						{#if target.url}
							<a
								href={target.url}
								target="_blank"
								rel="noopener external"
								class="text-accent hover:underline"
								title={target.note}>{target.label} ↗</a
							>
						{:else if target.id}
							<a href={href(target.id)} class="text-accent hover:underline">{target.label}</a>
							{#if target.visibility === 'gm'}
								<span
									class="rounded border border-accent px-1 py-0.5 text-[10px] tracking-wide text-accent uppercase"
									>{badge}</span
								>
							{/if}
						{/if}
					{/each}
				</li>
			{/each}
		</ul>
	</div>
{/if}

{#if loadError}
	<p class="mt-4 text-muted">Couldn’t load the search index: {loadError}</p>
{:else if !index}
	<p class="mt-4 text-muted">Loading search…</p>
{:else if !debounced.trim()}
	<p class="mt-4 text-muted">Type to search titles and rules text across {gameName}.</p>
{:else if results.length === 0}
	<p class="mt-4 text-muted">No matches for “{debounced}”.</p>
{:else}
	<p class="mt-4 text-sm text-muted">
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
	{#if variant === 'panel'}
		<!-- The panel is a shortcut, not the whole surface: the route keeps the
		     shareable ?q= and the room to read snippets. -->
		<!-- searchHref composes the resolve()d search route + its ?q= -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={searchHref} class="mt-3 inline-block text-sm text-accent hover:underline">
			See all results for “{debounced}”
		</a>
	{/if}
{/if}

<style>
	.reference-snippet :global(mark) {
		background-color: color-mix(in oklab, var(--sb-accent) 28%, transparent);
		color: inherit;
		border-radius: 2px;
		padding: 0 1px;
	}
</style>
