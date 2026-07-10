<!-- GM moves (general, exploration, homefront) and how to deal harm — the damage
	ladder, the three debilities, and recovery/tending. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import Markdown from '../../wizard/components/Markdown.svelte';
	import StringList from '../blocks/StringList.svelte';
	import LabelledTable from '../blocks/LabelledTable.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
	const dd = $derived(gm.damageAndDebilities);
</script>

<section>
	<h2 class="text-lg font-semibold">GM moves</h2>
	<div class="mt-2 grid gap-4 sm:grid-cols-3">
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">General</p>
			<StringList items={gm.gmMoves.general} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">Exploration</p>
			<StringList items={gm.gmMoves.exploration} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wide text-muted uppercase">Homefront</p>
			<StringList items={gm.gmMoves.homefront} />
		</div>
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Damage & debilities</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={dd.text} /></div>
	<LabelledTable
		headers={['Effect', 'Die']}
		rows={dd.damageLadder.map((d) => [d.effect, d.die] as [string, string])}
	/>

	<h3 class="mt-4 font-semibold">Debilities</h3>
	<dl class="mt-2 space-y-1 text-sm">
		{#each dd.debilities as deb (deb.name)}
			<div>
				<dt class="inline font-medium capitalize">{deb.name}:</dt>
				<dd class="inline text-muted"><Markdown text={deb.text} inline /></dd>
			</div>
		{/each}
	</dl>

	<h3 class="mt-4 font-semibold">Recovery & tending</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={dd.recover} /></div>
	<p class="mt-2 text-sm font-medium">Tending may require:</p>
	<StringList items={dd.tendingRequirements} />
	<p class="mt-2 text-xs text-muted italic">{dd.tendingNote}</p>
</section>
