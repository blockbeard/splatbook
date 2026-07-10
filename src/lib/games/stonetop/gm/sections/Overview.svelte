<!-- Overview: the GM's agenda, principles, the core conversational loop, and the
	standing "other things to do". The core loop's cyclic diagram is added in
	commit 51; here it renders as the numbered procedure. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import StringList from '../blocks/StringList.svelte';
	import StepList from '../blocks/StepList.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
</script>

<section>
	<h2 class="text-lg font-semibold">Agenda</h2>
	<p class="mt-1 text-sm text-muted">Always do these three things.</p>
	<StringList items={gm.agenda} />
</section>

<section>
	<h2 class="text-lg font-semibold">Principles</h2>
	<StringList items={gm.principles} />
</section>

<section>
	<h2 class="text-lg font-semibold">The core loop</h2>
	<StepList steps={gm.coreLoop.steps} />
</section>

<section>
	<h2 class="text-lg font-semibold">Other things to do</h2>
	<StringList items={gm.coreLoop.otherThingsToDo} />
</section>
