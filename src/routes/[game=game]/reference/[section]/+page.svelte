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

	let opting = $state(false);

	/**
	 * Opt in and re-load — no navigation needed: this route's own `+page.ts`
	 * reruns against the updated preference and returns the page the reader
	 * actually asked for in place of this interstitial, same URL.
	 */
	async function optIn(): Promise<void> {
		opting = true;
		try {
			await savePreference(referenceShowSetting(gameId), 'true', {
				signedIn: !!page.data.session?.user?.id
			});
			await invalidate('reference:showSetting');
		} finally {
			opting = false;
		}
	}
</script>

<svelte:head>
	<title>{data.section.title} — {data.docTitle}</title>
</svelte:head>

<nav class="text-sm text-muted" aria-label="Breadcrumb">
	<a href={refRoot} class="hover:text-accent">{data.docTitle}</a>
	{#each data.ancestors as crumb (crumb.id)}
		<span class="px-1.5 text-border">/</span>
		<a href={href(crumb.id)} class="hover:text-accent">{crumb.title}</a>
	{/each}
</nav>

<article class="reference-body mt-3">
	<h1 class="text-2xl font-bold tracking-tight">{data.section.title}</h1>
	<!-- Trusted: first-party pack content rendered from markdown by marked (render.ts),
	     not user input. No untrusted HTML reaches this sink. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html data.bodyHtml}

	{#if data.interstitial}
		<button
			type="button"
			onclick={optIn}
			disabled={opting}
			class="mt-6 inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
		>
			{opting ? 'Including…' : 'Include this — take me back'}
		</button>
	{/if}
</article>

{#if data.children.length}
	<!-- Navigation, not book prose — outside the article so a game's
	     .reference-body heading styles never inflate the label. One column,
	     hierarchy preserved: a two-column flat grid read top-to-bottom-then-
	     across (or across-then-down — readers split on it) either way
	     scrambled the book's order. -->
	<section class="section-children mt-6 border-t border-border pt-4">
		<h2 class="text-sm font-semibold text-muted">In this section</h2>
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
