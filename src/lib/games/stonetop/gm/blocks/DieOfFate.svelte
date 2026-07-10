<!--
	A rollable d6 outcome table. Tapping "Roll" rolls the Die of Fate, highlights
	the matching row, and calls out the result — used for the Die-of-Fate tables
	(When the Way is Perilous, Make Camp) and the seasonal weather tables. Rolling
	is view state only (nothing persists); the range→row matching is the pure
	`roll` helper, so this component stays a thin shell over tested logic.
-->
<script lang="ts">
	import Markdown from '../../wizard/components/Markdown.svelte';
	import { rollDie, matchingRowIndex } from '../roll';

	let {
		rows,
		buttonLabel = 'Roll the Die of Fate'
	}: { rows: readonly { roll: string; result: string }[]; buttonLabel?: string } = $props();

	let rolled = $state<number | null>(null);
	const specs = $derived(rows.map((r) => r.roll));
	const activeIndex = $derived(rolled === null ? -1 : matchingRowIndex(specs, rolled));

	function roll(): void {
		rolled = rollDie();
	}
</script>

<div class="mt-2">
	<div class="flex items-center gap-3">
		<button
			type="button"
			onclick={roll}
			class="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-medium hover:bg-accent/20"
		>
			{buttonLabel}
		</button>
		{#if rolled !== null}
			<span class="text-sm text-muted" aria-live="polite">
				Rolled a <span class="font-mono font-semibold text-text">{rolled}</span>
			</span>
		{/if}
	</div>

	<table class="gm-table mt-2 w-full text-sm">
		<thead>
			<tr>
				<th class="w-16">Roll</th>
				<th>Result</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as row, i (i)}
				<tr class:is-active={i === activeIndex}>
					<td class="font-mono whitespace-nowrap">{row.roll}</td>
					<td><Markdown text={row.result} inline /></td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

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
	.gm-table tr.is-active td {
		background: color-mix(in oklch, var(--sb-accent, currentColor) 15%, transparent);
		font-weight: 500;
	}
</style>
