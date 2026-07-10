<!--
	A static d6 outcome table (roll range → result). Die-of-Fate and weather
	tables use the rollable `DieOfFate` component instead (commit 50); this covers
	the non-rollable ones (e.g. When the Way is Perilous is authored as a table).
-->
<script lang="ts">
	import Markdown from '../../wizard/components/Markdown.svelte';
	import type { GmRollRow } from '../../pack-schemas';

	let { rows, rollLabel = 'Roll' }: { rows: readonly GmRollRow[]; rollLabel?: string } = $props();
</script>

<table class="gm-table mt-2 w-full text-sm">
	<thead>
		<tr>
			<th class="w-16">{rollLabel}</th>
			<th>Result</th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.roll)}
			<tr>
				<td class="font-mono whitespace-nowrap">{row.roll}</td>
				<td><Markdown text={row.result} inline /></td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.gm-table :global(th),
	.gm-table :global(td) {
		border: 1px solid var(--sb-border, currentColor);
		padding: 0.25rem 0.5rem;
		text-align: left;
		vertical-align: top;
	}
	.gm-table :global(th) {
		font-weight: 600;
	}
</style>
