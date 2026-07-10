<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data } = $props();

	const gameId = $derived(page.params.game as string);
	const href = (id: string) =>
		resolve('/g/[game]/reference/[section]', { game: gameId, section: id });
	const refRoot = $derived(resolve('/g/[game]/reference', { game: gameId }));
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

	{#if data.children.length}
		<section class="mt-6 border-t border-border pt-4">
			<h2 class="text-xs font-semibold uppercase tracking-wide text-muted">In this section</h2>
			<ul class="mt-2 grid gap-1 sm:grid-cols-2">
				{#each data.children as child (child.id)}
					<li><a href={href(child.id)} class="text-accent hover:underline">{child.title}</a></li>
				{/each}
			</ul>
		</section>
	{/if}
</article>

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
	.reference-body :global(h2) {
		margin-top: 1.5rem;
		font-size: 1.25rem;
		font-weight: 700;
	}
	.reference-body :global(h3) {
		margin-top: 1.25rem;
		font-size: 1.05rem;
		font-weight: 600;
	}
	.reference-body :global(h4) {
		margin-top: 1rem;
		font-weight: 600;
	}
	.reference-body :global(p),
	.reference-body :global(ul),
	.reference-body :global(ol),
	.reference-body :global(blockquote),
	.reference-body :global(table) {
		margin-top: 0.75rem;
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
</style>
