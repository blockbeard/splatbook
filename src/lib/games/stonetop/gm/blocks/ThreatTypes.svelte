<!--
	The eight threat types and their move lists, made interactive: pick a type to
	see its moves, and "Suggest a move" to spotlight a random one at the table.
	Selection and suggestion are view state only.
-->
<script lang="ts">
	import Markdown from '../../wizard/components/Markdown.svelte';
	import { rollDie } from '../roll';

	interface ThreatType {
		id: string;
		name: string;
		moves: string[];
	}

	let { types }: { types: readonly ThreatType[] } = $props();

	// The type list is a fixed pack constant; capturing the first id as the initial
	// selection once is deliberate.
	// svelte-ignore state_referenced_locally
	let selectedId = $state(types[0]?.id ?? '');
	let suggestedIndex = $state<number | null>(null);

	const selected = $derived(types.find((t) => t.id === selectedId) ?? types[0]);

	function pick(id: string): void {
		selectedId = id;
		suggestedIndex = null;
	}

	function suggest(): void {
		const n = selected?.moves.length ?? 0;
		suggestedIndex = n > 0 ? rollDie(n) - 1 : null;
	}
</script>

<div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="Threat type">
	{#each types as type (type.id)}
		<button
			type="button"
			onclick={() => pick(type.id)}
			aria-pressed={type.id === selectedId}
			class="rounded-md border px-3 py-1.5 text-sm transition-colors {type.id === selectedId
				? 'border-accent bg-accent/10 font-medium'
				: 'border-border hover:bg-surface'}"
		>
			{type.name}
		</button>
	{/each}
</div>

{#if selected}
	<div class="mt-3 rounded-md border border-border p-3">
		<div class="flex items-center justify-between gap-3">
			<h3 class="font-semibold">{selected.name} moves</h3>
			<button
				type="button"
				onclick={suggest}
				class="rounded-md border border-accent bg-accent/10 px-2.5 py-1 text-xs font-medium hover:bg-accent/20"
			>
				Suggest a move
			</button>
		</div>
		<ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
			{#each selected.moves as move, i (i)}
				<li class:is-suggested={i === suggestedIndex}>
					<Markdown text={move} inline />
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	li.is-suggested {
		border-radius: 0.25rem;
		background: color-mix(in oklch, var(--sb-accent, currentColor) 15%, transparent);
		padding: 0 0.35rem;
		font-weight: 500;
	}
</style>
