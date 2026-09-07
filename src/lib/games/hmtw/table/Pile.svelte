<!--
	A deck or a discard: a stack you take the top of.

	A draw pile shows a back and a count; a discard shows its top card face up,
	which is what a discard is for — everyone can see what went there last. The
	count is never a secret. How thick a pile is, is something you can see across
	a real table.
-->
<script lang="ts">
	import type { FaceIndex } from './faces';
	import type { ProjectedZone } from '$lib/card-table/client-types';
	import Card from './Card.svelte';
	import type { Pick } from '$lib/card-table/selection';

	let {
		zone,
		label,
		faces,
		selected = null,
		droppable = false,
		onSelect,
		onDrop,
		onOpen
	}: {
		zone: ProjectedZone;
		label: string;
		faces: FaceIndex;
		selected?: Pick | null;
		droppable?: boolean;
		onSelect?: (pick: Pick) => void;
		onDrop?: (zoneId: string) => void;
		/** Open the pile to look through it. Discards only — a draw pile has
		 * nothing to look at, and offering it would suggest otherwise. */
		onOpen?: (zoneId: string) => void;
	} = $props();

	const top = $derived(zone.cards?.[0] ?? null);
	const face = $derived(top ? (faces[top] ?? null) : null);
	const isSelected = $derived(selected?.zone === zone.id && selected?.card === undefined);
</script>

<div class="pile" class:ct-drop={droppable} class:pile--empty={zone.count === 0}>
	<p class="ct-zone-label">{label}</p>

	{#if zone.count === 0}
		<button
			type="button"
			class="pile__empty"
			aria-label={`${label}, empty`}
			onclick={() => onDrop?.(zone.id)}
		></button>
	{:else}
		<Card
			{face}
			faceDown={face === null}
			selected={isSelected}
			pick={{ zone: zone.id }}
			onSelect={(p) => (droppable ? onDrop?.(zone.id) : onSelect?.(p))}
		/>
	{/if}

	<p class="pile__count">
		{zone.count}
		{#if onOpen && zone.count > 0}
			<button type="button" class="pile__open" onclick={() => onOpen(zone.id)}>look through</button>
		{/if}
	</p>
</div>

<style>
	.pile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		padding: 0.5rem;
		border-radius: 4px;
	}
	.pile__empty {
		inline-size: var(--ct-card-w);
		block-size: var(--ct-card-h);
		border: 1px dashed var(--ct-rule);
		border-radius: var(--ct-radius);
		background: none;
		cursor: pointer;
	}
	.pile__count {
		font-family: 'IM Fell English', Georgia, serif;
		font-size: 0.8rem;
		color: rgb(236 231 219 / 50%);
		margin: 0;
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
	}
	.pile__open {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: var(--ct-light);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
</style>
