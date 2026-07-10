<!-- Sites & discoveries: building interesting places, the discoveries the PCs can
	find there (clues, encounters, opportunities, artifacts & arcana), and the four
	ways to frame a hazard. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import Markdown from '../../wizard/components/Markdown.svelte';
	import StringList from '../blocks/StringList.svelte';
	import StepList from '../blocks/StepList.svelte';
	import LabelledTable from '../blocks/LabelledTable.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
	const s = $derived(gm.sites);
	const d = $derived(gm.discoveries);
	const h = $derived(gm.hazards);
</script>

<section>
	<h2 class="text-lg font-semibold">Sites</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={s.text} /></div>
	<p class="mt-3 text-sm font-medium">Considerations:</p>
	<StringList items={s.considerations} />
	<h3 class="mt-4 font-semibold">Exploration</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={s.exploration} /></div>
	<h3 class="mt-4 font-semibold">Creating a site</h3>
	<StepList steps={s.creation} />
</section>

<section>
	<h2 class="text-lg font-semibold">Discoveries</h2>
	<h3 class="mt-2 font-semibold">Clues</h3>
	<p class="mt-1 text-sm text-muted">{d.clues.text}</p>
	<StringList items={d.clues.items} />
	<h3 class="mt-4 font-semibold">Encounters</h3>
	<StringList items={d.encounters.items} />
	<h3 class="mt-4 font-semibold">Opportunities</h3>
	<StringList items={d.opportunities.items} />
	<h3 class="mt-4 font-semibold">Artifacts & arcana</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={d.artifactsAndArcana} /></div>
</section>

<section>
	<h2 class="text-lg font-semibold">Hazards</h2>
	<h3 class="mt-2 font-semibold">As a description</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={h.asDescription} /></div>
	<h3 class="mt-4 font-semibold">As GM moves</h3>
	<p class="mt-1 text-sm text-muted">{h.asGmMoves.text}</p>
	<StringList items={h.asGmMoves.items} />
	<p class="mt-2 text-xs text-muted italic">{h.asGmMoves.note}</p>
	<h3 class="mt-4 font-semibold">As impending doom</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={h.asImpendingDoom} /></div>
	<h3 class="mt-4 font-semibold">As player moves</h3>
	<p class="mt-1 text-sm text-muted">{h.asPlayerMoves.text}</p>
	<StringList items={h.asPlayerMoves.items} />
	<h3 class="mt-4 font-semibold">If it deals damage</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={h.ifItDealsDamage.text} /></div>
	<LabelledTable headers={['Effect', 'Die']} rows={h.ifItDealsDamage.ladder} />
	<p class="mt-3 text-sm font-medium">Modifiers:</p>
	<LabelledTable rows={h.ifItDealsDamage.modifiers} />
</section>
