<!--
	A bulleted list of pack strings, each rendered as inline Markdown (the GM
	playbook's prose carries emphasis). Shared across GM guide sections.
-->
<script lang="ts">
	import Markdown from '../../wizard/components/Markdown.svelte';

	let { items, ordered = false }: { items: readonly string[]; ordered?: boolean } = $props();
</script>

{#if ordered}
	<ol class="mt-2 list-decimal space-y-1 pl-5 text-sm">
		{#each items as item, i (i)}
			<li><Markdown text={item} inline /></li>
		{/each}
	</ol>
{:else}
	<ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
		{#each items as item, i (i)}
			<li><Markdown text={item} inline /></li>
		{/each}
	</ul>
{/if}
