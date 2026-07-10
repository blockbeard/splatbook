<!--
	GM guide shell — a sidebar of the game's guide sections (from the game module)
	beside the current section page. Mirrors the rules-reference layout: the nav is
	loaded once for the subtree and highlights the active section.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	const activeId = $derived(page.params.section);
	const href = (id: string) =>
		resolve('/g/[game]/gm/[section]', { game: data.gameId, section: id });
</script>

<div class="flex flex-col gap-8 md:flex-row md:gap-10">
	<nav class="shrink-0 md:w-64 md:border-r md:border-border md:pr-6" aria-label="GM guide contents">
		<a
			href={resolve('/g/[game]', { game: data.gameId })}
			class="block text-sm font-semibold tracking-tight hover:text-accent"
		>
			{data.gameName} — GM guide
		</a>
		<ul class="mt-3 space-y-0.5 text-sm">
			{#each data.sections as section (section.id)}
				{@const active = section.id === activeId}
				<li>
					<a
						href={href(section.id)}
						class="block rounded px-2 py-1 hover:bg-surface hover:text-accent"
						class:bg-surface={active}
						class:font-medium={active}
						class:text-accent={active}
						aria-current={active ? 'page' : undefined}
					>
						{section.title}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
