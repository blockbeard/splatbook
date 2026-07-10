<!-- Monsters & followers: the step-by-step build procedures for each, plus the
	rules for running followers in play, group followers, and abstracting large
	group exchanges. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import Markdown from '../../wizard/components/Markdown.svelte';
	import StepList from '../blocks/StepList.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
	const m = $derived(gm.monsters);
	const f = $derived(gm.followers);
</script>

<section>
	<h2 class="text-lg font-semibold">Building a monster</h2>
	<StepList steps={m.steps} />
	<h3 class="mt-4 font-semibold">Monsters & followers</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={m.monstersAndFollowers} /></div>
</section>

<section>
	<h2 class="text-lg font-semibold">Building a follower</h2>
	<StepList steps={f.steps} />
	<h3 class="mt-4 font-semibold">Followers in play</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={f.inPlay} /></div>
	<h3 class="mt-4 font-semibold">Group followers</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={f.groupFollowers} /></div>
	<h3 class="mt-4 font-semibold">Abstracting group exchanges</h3>
	<div class="mt-1 text-sm text-muted"><Markdown text={f.abstractingGroupExchanges} /></div>
</section>
