<!-- NPCs: name lists by region, traits, the question menus (locals / outsiders /
	heard-of), physical impressions, instinct, tags & moves, connections,
	motivations, embodiment tricks, stats, and the Persuade move. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import Markdown from '../../wizard/components/Markdown.svelte';
	import StringList from '../blocks/StringList.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
	const n = $derived(gm.npcs);
</script>

<section>
	<h2 class="text-lg font-semibold">Names</h2>
	<p class="mt-1 text-xs text-muted">{n.names.note}</p>
	<div class="mt-2 space-y-1">
		{#each n.names.lists as list (list.region)}
			<details class="rounded-md border border-border p-2">
				<summary class="cursor-pointer text-sm font-medium">
					{list.region}
					<span class="text-muted">— {list.sound}</span>
				</summary>
				<p class="mt-2 text-sm text-muted">{list.names.join(', ')}</p>
			</details>
		{/each}
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Traits</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={n.trait} /></div>
</section>

<section>
	<h2 class="text-lg font-semibold">Questions</h2>
	<div class="mt-2 grid gap-4 sm:grid-cols-3">
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">Locals</p>
			<StringList items={n.questions.locals} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">Outsiders</p>
			<StringList items={n.questions.outsiders} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">Heard of</p>
			<StringList items={n.questions.heardOf} />
		</div>
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Impressions</h2>
	<p class="mt-1 text-xs text-muted">{n.impressions.note}</p>
	<dl class="mt-2 space-y-1 text-sm">
		{#each n.impressions.areas as area (area.area)}
			<div>
				<dt class="inline font-medium">{area.area}:</dt>
				<dd class="inline text-muted">{area.options}</dd>
			</div>
		{/each}
	</dl>
</section>

<section>
	<h2 class="text-lg font-semibold">Instinct</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={n.instinct} /></div>
</section>

<section>
	<h2 class="text-lg font-semibold">Tags & moves</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={n.tagsAndMoves} /></div>
</section>

<section>
	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<h2 class="text-lg font-semibold">Connections</h2>
			<StringList items={n.connections} />
		</div>
		<div>
			<h2 class="text-lg font-semibold">Motivations</h2>
			<StringList items={n.motivations} />
		</div>
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Embodiment</h2>
	<StringList items={n.embodiment} />
</section>

<section>
	<h2 class="text-lg font-semibold">Stats</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={n.hpArmorDamage} /></div>
</section>

<section>
	<h2 class="text-lg font-semibold">Persuading an NPC</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={n.persuade.move} /></div>
	<p class="mt-3 text-sm font-medium">Convincers:</p>
	<StringList items={n.persuade.convincers} />
	<div class="mt-2 text-sm text-muted"><Markdown text={n.persuade.note} /></div>
</section>
