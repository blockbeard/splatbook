<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const href = (id: string) =>
		resolve('/g/[game]/reference/[section]', { game: data.gameId, section: id });
</script>

<svelte:head>
	<title>{data.gameName} — Rules reference</title>
</svelte:head>

<h1 class="text-2xl font-bold tracking-tight">Rules reference</h1>
<p class="mt-2 max-w-2xl text-muted">
	Browse or search the {data.gameName} rules. Pick a chapter below, or use the contents on the left; every
	heading has its own page and shareable link.
</p>

{#each data.toc as doc (doc.id)}
	<section class="mt-8">
		<h2 class="text-lg font-semibold">{doc.title}</h2>
		<ul class="mt-3 grid gap-2 sm:grid-cols-2">
			{#each doc.sections.filter((s) => s.level === 1) as section (section.id)}
				<li>
					<a href={href(section.id)} class="text-accent hover:underline">{section.title}</a>
				</li>
			{/each}
		</ul>
	</section>
{/each}
