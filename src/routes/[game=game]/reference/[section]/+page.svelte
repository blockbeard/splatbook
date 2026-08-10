<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { referenceShowSetting, savePreference } from '$lib/preferences';

	let { data } = $props();

	const gameId = $derived(page.params.game as string);
	const href = (id: string) =>
		resolve('/[game=game]/reference/[section]', { game: gameId, section: id });
	const refRoot = $derived(resolve('/[game=game]/reference', { game: gameId }));

	/** Where a child node lives: its own page, an anchor on this page, or an
	 * anchor on a descendant page (referencePageDepth — inline sections). */
	const nodeHref = (node: (typeof data.children)[number]) =>
		node.pageId === node.id
			? href(node.id)
			: node.pageId === data.section.id
				? `#${node.id}`
				: `${href(node.pageId)}#${node.id}`;

	/**
	 * This page *is* its whole document — a one-section document whose title
	 * matches the section's, as the hand-authored opt-in note is. The document
	 * name adds nothing here: as a breadcrumb it repeats the h1 directly under
	 * it, and in the tab title it repeats itself. (`ReferenceToc` and the
	 * reference landing apply the same rule to the same documents.)
	 */
	const selfTitledDoc = $derived(
		data.ancestors.length === 0 && data.docTitle === data.section.title
	);

	let opting = $state(false);

	/**
	 * Write the opt-in and re-load — no navigation needed: this route's own
	 * `+page.ts` reruns against the updated preference. On an interstitial that
	 * returns the page the reader actually asked for, same URL; on the notice
	 * page itself it returns the notice with the control flipped.
	 */
	async function setOptIn(next: boolean): Promise<void> {
		opting = true;
		try {
			await savePreference(referenceShowSetting(gameId), String(next), {
				signedIn: !!page.data.session?.user?.id
			});
			await invalidate('reference:showSetting');
		} finally {
			opting = false;
		}
	}
</script>

<svelte:head>
	<!-- A one-page document is titled the same as its only section (the opt-in
	     note), and "Gamemaster Content — Gamemaster Content" is not a tab title. -->
	<title>{data.section.title}{selfTitledDoc ? '' : ` — ${data.docTitle}`}</title>
</svelte:head>

{#if !selfTitledDoc}
	<nav class="text-sm text-muted" aria-label="Breadcrumb">
		<a href={refRoot} class="hover:text-accent">{data.docTitle}</a>
		{#each data.ancestors as crumb (crumb.id)}
			<span class="px-1.5 text-border">/</span>
			<a href={href(crumb.id)} class="hover:text-accent">{crumb.title}</a>
		{/each}
	</nav>
{/if}

<article class="reference-body mt-3">
	<h1 class="text-2xl font-bold tracking-tight">{data.section.title}</h1>
	{#if data.interstitial}
		<!-- The passage below is written to be read on its own (it's a page in the
		     contents now, not only something shown in place of something else), so
		     nothing in it acknowledges that the reader asked for a different page.
		     This line does. -->
		<p class="mt-2 text-sm text-muted">The page you asked for is part of this.</p>
	{/if}
	<!-- Trusted: first-party pack content rendered from markdown by marked (render.ts),
	     not user input. No untrusted HTML reaches this sink. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.bodyHtml}

	{#if data.interstitial}
		<!-- One button, two things — the opt-in *and* the return to the page that
		     sent them here — so it has to name both in the order they happen. Its
		     predecessor ("Include this — take me back") named them as alternatives
		     and left the reader to guess which one it did. -->
		<button
			type="button"
			onclick={() => setOptIn(true)}
			disabled={opting}
			class="mt-6 inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
		>
			{opting ? 'Opting in…' : 'Opt in and continue'}
		</button>
	{:else if data.isSpoilerNotice}
		<!-- The reader came to this page deliberately, so there's nothing to
		     continue to: the control just states where they stand and offers the
		     other direction. Shell words, not the game's — the sidebar checkbox
		     carries the pack's own `toggleLabel`, and repeating it here would put
		     two controls with the same accessible name on one page. -->
		<div class="mt-6 flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={() => setOptIn(!data.showSetting)}
				disabled={opting}
				class="inline-block rounded-md px-4 py-2 font-medium disabled:opacity-60 {data.showSetting
					? 'border border-border hover:text-accent'
					: 'bg-accent text-accent-contrast hover:opacity-90'}"
			>
				{#if opting}
					Saving…
				{:else}
					{data.showSetting ? 'Opt out' : 'Opt in'}
				{/if}
			</button>
			{#if data.showSetting}
				<p class="text-sm text-muted">You’re opted in.</p>
			{/if}
		</div>
	{/if}
</article>

{#if data.children.length}
	<!-- Navigation, not book prose — outside the article so a game's
	     .reference-body heading styles never inflate the label. One column,
	     hierarchy preserved: a two-column flat grid read top-to-bottom-then-
	     across (or across-then-down — readers split on it) either way
	     scrambled the book's order.

	     On a page whose body is only front matter (`isContentsPage` — a chapter
	     opener like "Chapter 1: The Basics", a lead-in like "The Omphalic
	     Market"), this list isn't a footnote under the prose: it IS the page.
	     Those pages used to wear exactly the same clothes as one that answers a
	     question, so a reader mid-session couldn't tell from the top of the
	     screen whether they had arrived or were still navigating. Promoted, the
	     label goes away — nothing above it to be "in" — and the entries take the
	     contents-page treatment the reference landing already defines. -->
	<section
		class="section-children {data.isContentsPage
			? 'reference-contents mt-5'
			: 'mt-6 border-t border-border pt-4'}"
	>
		<h2 class="text-sm font-semibold text-muted" class:sr-only={data.isContentsPage}>
			{data.isContentsPage ? 'Contents' : 'In this section'}
		</h2>
		<!-- One level shows; deeper levels sit behind disclosure toggles — which
		     also keeps an h3-under-h2 from reading identically to an h2-under-h1
		     (both are just "one level down" until you open them). -->
		{#snippet childList(nodes: typeof data.children, nested: boolean)}
			<ul class="mt-1 space-y-0.5 {nested ? 'border-l border-border pl-4' : ''}">
				{#each nodes as node (node.id)}
					<li>
						{#if node.children.length}
							<details>
								<summary class="cursor-pointer marker:text-muted">
									<!-- nodeHref composes resolve()d section routes (+ in-page anchors) -->
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
									<a href={nodeHref(node)} class="text-accent hover:underline">{node.title}</a>
								</summary>
								{@render childList(node.children, true)}
							</details>
						{:else}
							<!-- ml aligns leaf titles with summary text after the marker;
							     nodeHref composes resolve()d section routes (+ in-page anchors) -->
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={nodeHref(node)} class="ml-[1.2em] text-accent hover:underline"
								>{node.title}</a
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/snippet}
		{@render childList(data.children, false)}
	</section>
{/if}

<!-- Guarded: a single-page document (the opt-in note) and the interstitial both
     have no neighbours in either direction, and an unguarded nav rendered as a
     bare rule floating under the last thing on the page. -->
{#if data.prev || data.next}
	<nav
		class="mt-8 flex justify-between gap-4 border-t border-border pt-4 text-sm"
		aria-label="Section navigation"
	>
		{#if data.prev}
			<a href={href(data.prev.id)} class="text-muted hover:text-accent">← {data.prev.title}</a>
		{:else}
			<span></span>
		{/if}
		{#if data.next}
			<a href={href(data.next.id)} class="text-right text-muted hover:text-accent"
				>{data.next.title} →</a
			>
		{/if}
	</nav>
{/if}

<style>
	/*
	 * Heading rhythm. Spacing here is margin-top only, so a heading's gap below
	 * is whatever its following sibling asks for — which made every heading sit
	 * about as far from the text it introduces as from the text it follows, and
	 * grouped it with the wrong side. h5/h6 had it worst: they were never given
	 * a margin-top at all, so they landed 2px under the preceding paragraph
	 * (a sub-heading dressed as a continuation of the section above it).
	 *
	 * A heading now takes clear space above and sits tight to what it heads.
	 */
	.reference-body :global(h2) {
		margin-top: 2.25rem;
		font-size: 1.25rem;
		font-weight: 700;
	}
	.reference-body :global(h3) {
		margin-top: 1.85rem;
		font-size: 1.05rem;
		font-weight: 600;
	}
	.reference-body :global(h4) {
		margin-top: 1.5rem;
		font-weight: 600;
	}
	.reference-body :global(h5),
	.reference-body :global(h6) {
		margin-top: 1.4rem;
	}
	.reference-body :global(p),
	.reference-body :global(ul),
	.reference-body :global(ol),
	.reference-body :global(blockquote),
	.reference-body :global(table) {
		margin-top: 0.75rem;
	}
	/* Binds the heading to its own content. Wins over the rule above by source
	   order at equal specificity, so it applies whatever follows the heading. */
	.reference-body :global(:is(h2, h3, h4, h5, h6) + *) {
		margin-top: 0.3rem;
	}
	.reference-body :global(ul) {
		list-style: disc;
		padding-left: 1.25rem;
	}
	.reference-body :global(ol) {
		list-style: decimal;
		padding-left: 1.25rem;
	}
	.reference-body :global(a) {
		color: var(--sb-accent, currentColor);
		text-decoration: underline;
	}
	.reference-body :global(blockquote) {
		border-left: 3px solid var(--sb-border, currentColor);
		padding-left: 0.75rem;
		color: var(--sb-muted, inherit);
	}
	.reference-body :global(table) {
		border-collapse: collapse;
	}
	.reference-body :global(th),
	.reference-body :global(td) {
		border: 1px solid var(--sb-border, currentColor);
		padding: 0.25rem 0.5rem;
		text-align: left;
	}
	.reference-body :global(code) {
		font-size: 0.9em;
	}

	/*
	 * Obsidian callouts (`> [!move] …`), rendered as asides by `render.ts`'s
	 * marked extension — generic, kind-neutral box + label here. A game theme
	 * skins a specific kind by overriding `--sb-callout-*` (or styling
	 * `.sb-callout-<kind>` directly) under its own `[data-game]` scope; e.g.
	 * `[!move]` gets the book's move-box look, `[!monster]` a swords icon
	 * (commit 94). Unthemed kinds still read fine off these shell defaults.
	 */
	.reference-body :global(.sb-callout) {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--sb-callout-border, var(--sb-border));
		border-radius: 0.375rem;
		background: var(--sb-callout-bg, var(--sb-surface));
	}
	.reference-body :global(.sb-callout-label) {
		margin: 0 0 0.375rem;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--sb-callout-label, var(--sb-accent));
	}
</style>
