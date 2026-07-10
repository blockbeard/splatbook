<!-- Expeditions & travel: Chart a Course, the requirement/challenge menus, the
	When-the-Way-is-Perilous and Make Camp Die-of-Fate tables, travel times, legs
	of travel, points of interest, and seasonal weather. The Die-of-Fate and
	weather tables become rollable in commit 50. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import Markdown from '../../wizard/components/Markdown.svelte';
	import StringList from '../blocks/StringList.svelte';
	import LabelledTable from '../blocks/LabelledTable.svelte';
	import RollTable from '../blocks/RollTable.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
	const e = $derived(gm.expeditions);
</script>

<section>
	<h2 class="text-lg font-semibold">Chart a Course</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={e.chartACourse} /></div>
	<p class="mt-3 text-sm font-medium">The GM may require…</p>
	<StringList items={e.requirements} />
</section>

<section>
	<h2 class="text-lg font-semibold">Challenges</h2>
	<StringList items={e.challenges} />
	<p class="mt-2 text-xs text-muted">{e.challengesNote}</p>
</section>

<section>
	<h2 class="text-lg font-semibold">When the way is perilous</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={e.whenTheWayIsPerilous.text} /></div>
	<RollTable rows={e.whenTheWayIsPerilous.table} />
</section>

<section>
	<h2 class="text-lg font-semibold">Travel times</h2>
	<div class="mt-2 space-y-4">
		{#each e.travelTimes as group, gi (gi)}
			<div>
				<p class="text-sm font-medium">{group.from}</p>
				<LabelledTable rows={group.entries} />
			</div>
		{/each}
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Make camp</h2>
	<p class="mt-1 text-sm font-medium">Ask:</p>
	<StringList items={e.makeCamp.questions} />
	<p class="mt-2 text-xs text-muted">{e.makeCamp.note}</p>
	<RollTable rows={e.makeCamp.dieOfFate} />
</section>

<section>
	<h2 class="text-lg font-semibold">Legs of travel</h2>
	<div class="mt-1 text-sm text-muted"><Markdown text={e.legsOfTravel.text} /></div>
	<p class="mt-3 text-sm font-medium">Questions to ask:</p>
	<StringList items={e.legsOfTravel.questions} />
	<p class="mt-3 text-sm font-medium">Soft moves:</p>
	<StringList items={e.legsOfTravel.softMoves} />
</section>

<section>
	<h2 class="text-lg font-semibold">Points of interest</h2>
	<StringList items={e.pointsOfInterest.items} />
	<div class="mt-2 text-sm text-muted"><Markdown text={e.pointsOfInterest.text} /></div>
	<p class="mt-3 text-sm font-medium">First-visit questions:</p>
	<StringList items={e.pointsOfInterest.firstVisitQuestions} />
	<div class="mt-2 text-sm text-muted"><Markdown text={e.pointsOfInterest.landmarkNote} /></div>
</section>

<section>
	<h2 class="text-lg font-semibold">Random weather</h2>
	<p class="mt-1 text-xs text-muted">{e.randomWeather.note}</p>
	<div class="mt-2 space-y-4">
		{#each e.randomWeather.tables as table (table.season)}
			<div>
				<p class="text-sm font-medium">{table.season}</p>
				<LabelledTable rows={table.rows} />
			</div>
		{/each}
	</div>
</section>
