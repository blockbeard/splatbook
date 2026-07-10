<!--
	A two-column table of `[label, value]` pairs — the GM playbook's option and
	stat tables (monster tags, damage modifiers, travel times, weather). Headers
	are optional; values render as inline Markdown.
-->
<script lang="ts">
	import Markdown from '../../wizard/components/Markdown.svelte';

	let {
		rows,
		headers
	}: { rows: readonly (readonly [string, string])[]; headers?: [string, string] } = $props();
</script>

<table class="gm-table mt-2 w-full text-sm">
	{#if headers}
		<thead>
			<tr>
				<th>{headers[0]}</th>
				<th>{headers[1]}</th>
			</tr>
		</thead>
	{/if}
	<tbody>
		{#each rows as [label, value], i (i)}
			<tr>
				<td><Markdown text={label} inline /></td>
				<td class="whitespace-nowrap"><Markdown text={value} inline /></td>
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
