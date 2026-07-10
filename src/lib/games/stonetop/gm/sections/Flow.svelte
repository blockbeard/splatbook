<!-- Flow of play: the recurring phases of a Stonetop campaign (first adventure,
	expedition, aftermath, crisis, downtime, seasons change) and the transitions
	between them. Rendered as a diagram in commit 51; here as node cards and a
	transition list. -->
<script lang="ts">
	import type { GmPlaybook } from '../../pack-schemas';
	import StringList from '../blocks/StringList.svelte';
	import FlowDiagram from '../blocks/FlowDiagram.svelte';

	let { gm }: { gm: GmPlaybook } = $props();
	const flow = $derived(gm.flowOfPlay);
	const nameOf = $derived(new Map(flow.nodes.map((node) => [node.id, node.name] as const)));
</script>

<section>
	<p class="text-sm text-muted">{flow.note}</p>
	<FlowDiagram nodes={flow.nodes} edges={flow.edges} />
</section>

<section>
	<h2 class="text-lg font-semibold">Phases</h2>
	<div class="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each flow.nodes as node (node.id)}
			<div class="rounded-md border border-border p-3">
				<h3 class="font-semibold">{node.name}</h3>
				{#if node.ref}<p class="text-xs text-muted">{node.ref}</p>{/if}
				<StringList items={node.items} />
			</div>
		{/each}
	</div>
</section>

<section>
	<h2 class="text-lg font-semibold">Transitions</h2>
	<ul class="mt-2 space-y-1 text-sm">
		{#each flow.edges as edge, i (i)}
			<li>
				<span class="font-medium">{nameOf.get(edge.from)}</span>
				<span class="text-muted">→</span>
				<span class="font-medium">{nameOf.get(edge.to)}</span>
				{#if edge.label}<span class="text-muted"> — {edge.label}</span>{/if}
			</li>
		{/each}
	</ul>
</section>
