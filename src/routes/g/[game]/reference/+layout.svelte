<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { buildSectionTree, type SectionNode } from '$lib/reference/document-tree';
	import type { TocSection } from '$lib/reference/load';

	let { data, children } = $props();

	const activeId = $derived(page.params.section);

	/** Ids of the active section's ancestors, so their branches render expanded. */
	function ancestorIds(sections: TocSection[], id: string | undefined): string[] {
		const out: string[] = [];
		if (!id) return out;
		const idx = sections.findIndex((s) => s.id === id);
		if (idx === -1) return out;
		let level = sections[idx].level;
		for (let i = idx - 1; i >= 0 && level > 1; i--) {
			if (sections[i].level < level) {
				out.push(sections[i].id);
				level = sections[i].level;
			}
		}
		return out;
	}

	// Ids whose disclosure branch should render open: the active section and its
	// ancestors. A plain array (read-only, recomputed) — no reactive Set needed.
	const openIds = $derived([
		activeId,
		...data.toc.flatMap((doc) => ancestorIds(doc.sections, activeId))
	]);

	const href = (id: string) =>
		resolve('/g/[game]/reference/[section]', { game: data.gameId, section: id });
</script>

<div class="flex flex-col gap-8 md:flex-row md:gap-10">
	<nav
		class="reference-toc shrink-0 md:w-72 md:border-r md:border-border md:pr-6"
		aria-label="Rules contents"
	>
		<a
			href={resolve('/g/[game]/reference', { game: data.gameId })}
			class="block text-sm font-semibold tracking-tight hover:text-accent"
		>
			{data.gameName} rules
		</a>
		<form
			action={resolve('/g/[game]/reference/search', { game: data.gameId })}
			class="mt-3"
			role="search"
		>
			<input
				name="q"
				type="search"
				placeholder="Search rules…"
				aria-label="Search the rules"
				class="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
			/>
		</form>
		{#each data.toc as doc (doc.id)}
			<div class="mt-4">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted">{doc.title}</p>
				<ul class="mt-1 text-sm">
					{#each buildSectionTree(doc.sections) as node (node.section.id)}
						{@render tocNode(node)}
					{/each}
				</ul>
			</div>
		{/each}
	</nav>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>

{#snippet tocNode(node: SectionNode<TocSection>)}
	{@const active = node.section.id === activeId}
	<li>
		{#if node.children.length}
			<details open={openIds.includes(node.section.id)}>
				<summary class="cursor-pointer list-none">
					<a
						href={href(node.section.id)}
						class="hover:text-accent"
						class:text-accent={active}
						class:font-medium={active}
					>
						{node.section.title}
					</a>
				</summary>
				<ul class="border-l border-border pl-3">
					{#each node.children as child (child.section.id)}
						{@render tocNode(child)}
					{/each}
				</ul>
			</details>
		{:else}
			<a
				href={href(node.section.id)}
				class="block py-0.5 hover:text-accent"
				class:text-accent={active}
				class:font-medium={active}
			>
				{node.section.title}
			</a>
		{/if}
	</li>
{/snippet}

<style>
	.reference-toc :global(summary::-webkit-details-marker) {
		display: none;
	}
	.reference-toc :global(summary) {
		position: relative;
		padding-left: 0.85rem;
	}
	.reference-toc :global(summary::before) {
		content: '▸';
		position: absolute;
		left: 0;
		color: var(--sb-muted, currentColor);
		transition: transform 0.12s ease;
	}
	.reference-toc :global(details[open] > summary::before) {
		transform: rotate(90deg);
	}
</style>
