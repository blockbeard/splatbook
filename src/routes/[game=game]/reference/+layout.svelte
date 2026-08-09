<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { afterNavigate, invalidate } from '$app/navigation';
	import { embed } from '$lib/embed.svelte';
	import { getLocalPreference, readShowSetting } from '$lib/preferences';
	import ReferenceSearch from './ReferenceSearch.svelte';
	import ReferenceToc from './ReferenceToc.svelte';
	import SpoilerToggle from './SpoilerToggle.svelte';

	let { data, children } = $props();

	// A signed-out visitor returning with a previously-set localStorage
	// preference: SSR couldn't read it (no localStorage on the server), so
	// the first paint defaulted closed. Reconcile once on mount — this only
	// does anything when the two actually disagree, so a first-time visitor
	// with nothing stored triggers no extra work.
	onMount(() => {
		if (page.data.session?.user?.id) return;
		const stored =
			readShowSetting(data.gameId, (k) => getLocalPreference(localStorage, k)) === 'true';
		if (stored !== data.showSetting) invalidate('reference:showSetting');
	});

	const activeId = $derived(page.params.section);

	/** The active entry's own title, for the drawer button — orientation while
	 *  scrolled, without spending a second row on a breadcrumb the section page
	 *  already renders above its prose. */
	const activeTitle = $derived.by(() => {
		if (!activeId) return 'Contents';
		for (const doc of data.toc) {
			const hit =
				doc.chapters.find((c) => c.id === activeId) ?? doc.sections.find((s) => s.id === activeId);
			if (hit) return hit.title;
		}
		return 'Contents';
	});

	// The TOC is a drawer below md (phase 25). Native <dialog>: focus stays
	// inside, the background goes inert, and there's no hand-rolled trap. NOTE:
	// deliberately no `overflow: hidden` on <body> — showModal() already blocks
	// background scroll, and freezing the body jams the dialog's own scrolling
	// on iOS and jumps the page to the top on dismiss, which is precisely the
	// lost-your-place-in-a-long-chapter problem this exists to fix.
	let drawer = $state<HTMLDialogElement | undefined>();
	// `dialog.open` is a DOM property, not reactive state — the button's
	// aria-expanded has to track opening separately.
	let drawerOpen = $state(false);
	// The drawer's contents mount on first open, never before. A second copy of
	// the tree and the spoiler toggle sitting in every page's DOM would be dead
	// weight on desktop, and would make every "the toggle" or "the contents"
	// selector — in tests and for assistive tech alike — ambiguous.
	let drawerMounted = $state(false);

	function openDrawer(): void {
		drawerMounted = true;
		drawer?.showModal();
		drawerOpen = true;
		// Land on the reader's position rather than chapter 1 — in a 17-note book
		// the top of the tree is nowhere near where they are.
		requestAnimationFrame(() =>
			drawer?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'center' })
		);
	}

	// The bar's search panel (phase 25). The <input> stays in the bar and the
	// panel opens *around* it: moving focus into a freshly mounted input makes iOS
	// dismiss and re-raise the soft keyboard, which reads as a flicker on every
	// search. Opened on pointerdown rather than focus — focus also fires on
	// keyboard tabbing and on the browser restoring focus after a back
	// navigation, either of which would drop a panel over the page unbidden.
	let panelOpen = $state(false);
	let query = $state('');
	let barEl = $state<HTMLElement | undefined>();

	afterNavigate(() => {
		drawer?.close();
		panelOpen = false;
	});

	// Crossing to the sidebar layout with the drawer open would leave an
	// invisible modal holding the page inert (`lg:hidden` hides it but doesn't
	// close it). 64rem must match the `lg:` classes below — and note media-query
	// rem is always 16px, so this is 1024px regardless of a game's root size.
	onMount(() => {
		const mq = window.matchMedia('(min-width: 64rem)');
		const sync = () => {
			if (!mq.matches) return;
			drawer?.close();
			panelOpen = false;
		};
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});
</script>

{#snippet searchForm(formClass: string, inputClass: string, live: boolean)}
	<!-- Still a real GET form even where the panel searches live: Enter (or a soft
	     keyboard's Go) lands on the search route with its shareable ?q=, and the
	     no-JS reader gets the same. -->
	<form
		action={resolve('/[game=game]/reference/search', { game: data.gameId })}
		class={formClass}
		role="search"
	>
		{#if live}
			<input
				bind:value={query}
				onpointerdown={() => (panelOpen = true)}
				name="q"
				type="search"
				placeholder="Search rules…"
				aria-label="Search the rules"
				class={inputClass}
			/>
		{:else}
			<input
				name="q"
				type="search"
				placeholder="Search rules…"
				aria-label="Search the rules"
				class={inputClass}
			/>
		{/if}
		{#if embed.active}
			<!-- SvelteKit intercepts this GET form but replaces the whole query
			     string with the form fields — without this, a search submit in
			     embed mode drops ?embed=1 and a mid-session reload resurrects
			     the app chrome. -->
			<input type="hidden" name="embed" value="1" />
		{/if}
	</form>
{/snippet}

<svelte:window
	onkeydown={(e) => e.key === 'Escape' && panelOpen && (panelOpen = false)}
	onpointerdown={(e) =>
		panelOpen && !barEl?.contains(e.target as Node) ? (panelOpen = false) : undefined}
/>

<!-- Below the sidebar breakpoint this is the only reference chrome. It stays in
     embed mode too — the embedded window is narrow and `.app-chrome` is hidden
     there, so without it an embedded reader has no nav at all.

     `-mt-8` cancels `main`'s top padding so the bar sits flush under the app
     header rather than floating below it. On a phone both rows are full and read
     as one block, but between ~700px and the sidebar breakpoint they are mostly
     empty space, and a gap between them turned two thin bars into two separate
     bands of chrome — 119px before the breadcrumb. Flush, bordered and sharing a
     background, they read as one header again. -->
<div
	bind:this={barEl}
	data-testid="reference-bar"
	class="reference-bar sticky top-0 z-30 -mx-4 -mt-8 mb-4 flex flex-wrap items-center gap-2 border-b border-border bg-bg px-4 py-2 lg:hidden"
>
	<button
		type="button"
		onclick={openDrawer}
		aria-haspopup="dialog"
		aria-expanded={drawerOpen}
		class="flex min-w-0 shrink items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5 text-sm hover:text-accent"
	>
		<svg
			class="size-4 shrink-0"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"
		>
			<path d="M2 4h12M2 8h12M2 12h12" stroke-linecap="round" />
		</svg>
		<span class="truncate">{activeTitle}</span>
	</button>
	{@render searchForm(
		'min-w-0 flex-1',
		'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent',
		true
	)}
	{#if panelOpen}
		<!-- Mounted only while open: closed, the panel leaves no second results
		     list or pinned block in the page's DOM. `query` lives out here, so
		     reopening resumes where the reader left off — and the index loaders
		     memoise, so it costs no second fetch or parse. -->
		<div
			data-testid="reference-search-panel"
			class="-mx-4 max-h-[70dvh] w-[100vw] overflow-y-auto border-t border-border bg-bg px-4 pt-1 pb-6"
		>
			<ReferenceSearch
				bind:query
				gameId={data.gameId}
				gameName={data.gameName}
				showSetting={data.showSetting}
				badge={data.spoilers?.badge ?? 'GM'}
				variant="panel"
				active={panelOpen}
			>
				{#snippet controls()}
					{#if data.spoilers}
						<!-- The opt-in belongs to the query surface: it's what selects the
						     GM index, and flipping it re-derives the results live. -->
						<div class="mt-2">
							<SpoilerToggle checked={data.showSetting} label={data.spoilers.toggleLabel} />
						</div>
					{/if}
				{/snippet}
			</ReferenceSearch>
		</div>
	{/if}
</div>

<!--
	The sidebar appears at `lg` (1024px), not `md` (768px). It is a fixed 18rem
	— 324px at this game's root size — so between those two widths it was taking
	42% of an iPad held in portrait and leaving the text column 363px, narrower
	than the same book gets on a 390px phone. The bar-and-drawer layout is the
	better interface at those sizes anyway, so it now serves both iPad
	orientations in portrait.

	`sticky` with its own `overflow-y`: the contents scrolls inside itself
	rather than with the page, so search and the chapter list stay put on a long
	rule — and expanding every chapter can't push entries out of reach, which a
	bare `position: sticky` would.
-->
<div class="flex flex-col gap-8 lg:flex-row lg:gap-10">
	<nav
		class="hidden shrink-0 lg:sticky lg:top-0 lg:block lg:max-h-dvh lg:w-72 lg:self-start lg:overflow-y-auto lg:border-r lg:border-border lg:pr-6 lg:pb-6"
		aria-label="Rules contents"
	>
		<a
			href={resolve('/[game=game]/reference', { game: data.gameId })}
			class="block text-sm font-semibold tracking-tight hover:text-accent"
		>
			{data.gameName} rules
		</a>
		{@render searchForm(
			'mt-3',
			'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent',
			false
		)}
		{#if data.spoilers}
			<!-- The opt-in lives here in the sidebar — every reference page, not
			     just search results — so the TOC itself offers the path to Book II. -->
			<div class="mt-2">
				<SpoilerToggle checked={data.showSetting} label={data.spoilers.toggleLabel} />
			</div>
		{/if}
		<ReferenceToc toc={data.toc} gameId={data.gameId} {activeId} />
	</nav>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>

<dialog
	bind:this={drawer}
	onclose={() => (drawerOpen = false)}
	class="reference-drawer lg:hidden"
	aria-label="Rules contents"
>
	{#if drawerMounted}
		<div class="flex h-full flex-col">
			<div class="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
				<a
					href={resolve('/[game=game]/reference', { game: data.gameId })}
					class="text-sm font-semibold tracking-tight hover:text-accent"
				>
					{data.gameName} rules
				</a>
				<button
					type="button"
					onclick={() => drawer?.close()}
					class="rounded-md border border-border px-2 py-1 text-sm hover:text-accent"
				>
					Close
				</button>
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-8">
				{#if data.spoilers}
					<!-- Keeps the labelled control reachable from the contents, not only
					     from a search: a reader browsing the TOC otherwise has no path to
					     Book II without incidentally searching first (staging, 2026-07-17). -->
					<div class="mt-3">
						<SpoilerToggle checked={data.showSetting} label={data.spoilers.toggleLabel} />
					</div>
				{/if}
				<ReferenceToc toc={data.toc} gameId={data.gameId} {activeId} />
			</div>
		</div>
	{/if}
</dialog>

<style>
	.reference-bar {
		padding-top: calc(0.5rem + env(safe-area-inset-top));
	}

	.reference-drawer {
		margin: 0;
		width: min(20rem, 88vw);
		max-width: none;
		height: 100dvh;
		max-height: none;
		padding: 0;
		border: 0;
		border-right: 1px solid var(--sb-border);
		background-color: var(--sb-bg);
		color: var(--sb-text);
		/* Keep a flick at the end of the list from scrolling the page behind —
		   the alternative (freezing <body>) is what breaks iOS. */
		overscroll-behavior: contain;
		padding-top: env(safe-area-inset-top);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.reference-drawer:not([open]) {
		display: none;
	}

	/* Discrete-property transitions: the dialog animates in from the edge and
	   back out without JS timers. */
	.reference-drawer,
	.reference-drawer::backdrop {
		transition:
			display 0.2s allow-discrete,
			overlay 0.2s allow-discrete,
			opacity 0.2s ease,
			translate 0.2s ease;
	}
	.reference-drawer {
		translate: -100% 0;
	}
	.reference-drawer[open] {
		translate: 0 0;
	}
	@starting-style {
		.reference-drawer[open] {
			translate: -100% 0;
		}
	}
	.reference-drawer::backdrop {
		background-color: color-mix(in oklab, black 45%, transparent);
		opacity: 0;
	}
	.reference-drawer[open]::backdrop {
		opacity: 1;
	}
	@starting-style {
		.reference-drawer[open]::backdrop {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.reference-drawer,
		.reference-drawer::backdrop {
			transition: none;
		}
	}
</style>
