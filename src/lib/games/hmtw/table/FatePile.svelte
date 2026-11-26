<!--
	The turned-over Tests of Fate, face up until somebody clears them.

	Shared by both modes (phase 33). It used to live only in Decks mode, so a
	Test of Fate in a Challenge had nowhere to be seen and nowhere to be
	cleared, and Session 14 lost two cards out of the deck to it.
-->
<script lang="ts">
	import Card from './Card.svelte';
	import type { FaceIndex } from './faces';
	import type { ProjectedZone } from '$lib/card-table/client-types';
	import type { Pick } from '$lib/card-table/selection';

	let {
		zone,
		faces,
		selected = null,
		locked = false,
		onSelect,
		onClear
	}: {
		zone: ProjectedZone;
		faces: FaceIndex;
		selected?: Pick | null;
		locked?: boolean;
		onSelect: (pick: Pick) => void;
		onClear: () => void;
	} = $props();

	const drawn = $derived(zone.cards ?? []);
</script>

{#if zone.count > 0}
	<section class="fate" aria-label="Test of Fate">
		<p class="ct-zone-label">
			Turned over — {drawn.reduce((n, c) => n + (faces[c]?.value ?? 0), 0)}
		</p>
		<div class="fate__cards">
			{#each drawn as card (card)}
				<Card
					face={faces[card] ?? null}
					greaterDoom={faces[card]?.greaterDoom ?? false}
					selected={selected?.card === card}
					pick={{ zone: zone.id, card }}
					{onSelect}
				/>
			{/each}
		</div>
		<p class="fate__note">Card values only. Your attribute, favour and Resolve are yours to add.</p>
		<button type="button" class="ct-btn ct-btn--quiet" disabled={locked} onclick={onClear}>
			Into the discard
		</button>
	</section>
{/if}

<style>
	.fate {
		border: 1px solid var(--ct-rule-strong);
		border-radius: 4px;
		padding: 0.75rem;
		display: grid;
		gap: 0.5rem;
		justify-items: start;
	}
	.fate__cards {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	/*
	 * The sum is of the cards and nothing else, and it says so.
	 *
	 * An action's total is the card plus an attribute, with favour at plus or
	 * minus three — and this table holds no character, so a number labelled
	 * "total" would be wrong in a way that costs somebody a fight.
	 */
	.fate__note {
		margin: 0;
		font-size: 0.78rem;
		color: var(--ct-quiet);
	}
</style>
