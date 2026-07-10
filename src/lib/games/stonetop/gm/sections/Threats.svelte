<!-- Threats: what they are, how to write them up and update them between sessions,
	the three trackers, and the eight threat types with their move lists. The move
	lists become interactive in commit 50. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import Markdown from '../../wizard/components/Markdown.svelte';
	import StringList from '../blocks/StringList.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
	const t = $derived(gm.threats);
</script>

<section>
	<div class="text-sm text-muted"><Markdown text={t.text} /></div>
</section>

<section>
	<h2 class="text-lg font-semibold">Writing up a threat</h2>
	<StringList items={t.writeUp} ordered />
</section>

<section>
	<h2 class="text-lg font-semibold">Updating threats</h2>
	<p class="mt-1 text-sm text-muted">{t.update.text}</p>
	<StringList items={t.update.items} />
</section>

<section>
	<h2 class="text-lg font-semibold">Trackers</h2>
	<div class="mt-2 flex flex-wrap gap-2">
		{#each t.trackers as tracker (tracker)}
			<span class="rounded-md border border-border px-3 py-1 text-sm font-medium">{tracker}</span>
		{/each}
	</div>
	<p class="mt-2 text-xs text-muted">{t.trackersNote}</p>
</section>

<section>
	<h2 class="text-lg font-semibold">Threat types & moves</h2>
	<div class="mt-2 grid gap-4 sm:grid-cols-2">
		{#each t.types as type (type.id)}
			<div class="rounded-md border border-border p-3">
				<h3 class="font-semibold">{type.name}</h3>
				<StringList items={type.moves} />
			</div>
		{/each}
	</div>
</section>
