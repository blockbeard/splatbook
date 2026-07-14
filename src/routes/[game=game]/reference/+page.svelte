<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const href = (id: string) =>
		resolve('/[game=game]/reference/[section]', { game: data.gameId, section: id });
</script>

<svelte:head>
	<title>{data.gameName} — Rules reference</title>
</svelte:head>

<h1 class="text-2xl font-bold tracking-tight">Rules reference</h1>
<p class="mt-2 max-w-2xl text-muted">
	Browse or search the {data.gameName} rules. Pick a chapter below, or use the contents on the left; every
	heading has its own page and shareable link.
</p>
{#if data.showSetting && data.spoilers}
	<p class="mt-2 text-xs text-accent">
		{data.spoilers.toggleLabel} — on. Change this from the search page.
	</p>
{/if}

{#each data.toc as doc (doc.id)}
	<section class="mt-8">
		<h2 class="text-lg font-semibold">{doc.title}</h2>
		<!-- Chapters are already in reading order (build_srd.py walks source files
		     sorted the same way); this is the book's own table of contents, one
		     card per source file, not a filtered slice of the section list. -->
		<ul class="mt-3 grid gap-2 sm:grid-cols-2">
			{#each doc.chapters as chapter (chapter.id)}
				<li>
					<a href={href(chapter.id)} class="text-accent hover:underline">
						{#if chapter.number}<span class="text-muted">{chapter.number}.</span>{/if}
						{chapter.title}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/each}
