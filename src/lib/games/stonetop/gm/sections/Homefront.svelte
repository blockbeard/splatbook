<!-- Home, downtime & aftermath: life in Stonetop, the questions and seasonal
	activities that fill homefront scenes, downtime and Make a Plan, aftermath, the
	"I wonder…" list, relative value of treasure, and the safety-tools lists. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import Markdown from '../../wizard/components/Markdown.svelte';
	import StringList from '../blocks/StringList.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
	const hf = $derived(gm.homefront);
	const life = $derived(hf.lifeInStonetop);
	const seasons = $derived(hf.seasonalActivities);
</script>

<section>
	<h2 class="text-lg font-semibold">Life in Stonetop</h2>
	<div class="mt-2 grid gap-4 sm:grid-cols-2">
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">People</p>
			<StringList items={life.people} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">Home & hearth</p>
			<StringList items={life.homeAndHearth} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">Trade & commerce</p>
			<StringList items={life.tradeAndCommerce} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">
				Protection & governance
			</p>
			<StringList items={life.protectionAndGovernance} />
		</div>
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Homefront questions</h2>
	<StringList items={hf.questionsToAsk} />
</section>

<section>
	<h2 class="text-lg font-semibold">Seasonal activities</h2>
	<div class="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each [['Spring', seasons.spring], ['Summer', seasons.summer], ['Autumn', seasons.autumn], ['Winter', seasons.winter], ['Always', seasons.always]] as [label, items] (label)}
			<div>
				<p class="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
				<StringList items={items as string[]} />
			</div>
		{/each}
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Downtime</h2>
	<StringList items={gm.downtime.items} />
	<p class="mt-2 text-xs text-muted">{gm.downtime.note}</p>
	<h3 class="mt-4 font-semibold">Make a Plan</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={gm.downtime.makeAPlan.move} /></div>
	<p class="mt-2 text-sm font-medium">Requirements the GM might name:</p>
	<StringList items={gm.downtime.makeAPlan.requirements} />
	<p class="mt-2 text-xs text-muted italic">{gm.downtime.makeAPlan.note}</p>
</section>

<section>
	<h2 class="text-lg font-semibold">Aftermath</h2>
	<StringList items={gm.aftermath} ordered />
</section>

<section>
	<h2 class="text-lg font-semibold">I wonder…</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={gm.iWonder.text} /></div>
</section>

<section>
	<h2 class="text-lg font-semibold">Relative value</h2>
	<div class="mt-2 space-y-2">
		{#each gm.relativeValue.values as v (v.value)}
			<div class="rounded-md border border-border p-3">
				<p class="text-sm font-semibold">Value {v.value}</p>
				<StringList items={v.worth} />
			</div>
		{/each}
	</div>
	<div class="mt-2">
		<StringList items={gm.relativeValue.notes} />
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Safety tools</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={gm.content.text} /></div>
	<dl class="mt-3 space-y-2 text-sm">
		{#each gm.content.lists as list (list.id)}
			<div>
				<dt class="font-medium">{list.title}</dt>
				{#if list.note}<dd class="text-muted">{list.note}</dd>{/if}
			</div>
		{/each}
	</dl>
</section>
