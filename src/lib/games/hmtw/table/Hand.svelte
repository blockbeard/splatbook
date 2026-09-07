<!--
	A hand of cards.

	Sorted by value, because ch.7's worked example has the GM do exactly that —
	"reorders their hand so that the cards are sequential just for ease of use" —
	and what is good enough for the book is good enough here.

	The GM's hand groups by doom tier as well, lesser before greater. That is not
	tidiness: the mulligan is offered for a hand that is "mostly greater dooms",
	with no threshold given, so the GM has to eyeball the split. Grouping is the
	interface answering the only question the rule asks.
-->
<script lang="ts">
	import Card from './Card.svelte';
	import type { FaceIndex } from './faces';
	import type { ProjectedZone } from '$lib/card-table/client-types';
	import type { Pick } from '$lib/card-table/selection';

	let {
		zone,
		faces,
		grouped = false,
		lit = [],
		selected = null,
		onSelect
	}: {
		zone: ProjectedZone;
		faces: FaceIndex;
		/** Split lesser dooms from greater — the GM's hand, and only theirs. */
		grouped?: boolean;
		/** Cards the chosen action would be paid with — lifted, never filtered. */
		lit?: string[];
		selected?: Pick | null;
		onSelect?: (pick: Pick) => void;
	} = $props();

	const byValue = (a: string, b: string) => (faces[a]?.value ?? 0) - (faces[b]?.value ?? 0);
	const sorted = $derived([...(zone.cards ?? [])].sort(byValue));
	const lesser = $derived(sorted.filter((c) => !faces[c]?.greaterDoom));
	const greater = $derived(sorted.filter((c) => faces[c]?.greaterDoom));
</script>

{#if zone.cards === undefined}
	<p class="hand__hidden">{zone.count} cards</p>
{:else if sorted.length === 0}
	<p class="hand__hidden">Nothing in hand</p>
{:else if grouped}
	<div class="hand__groups">
		{#each [['Lesser dooms', lesser], ['Greater dooms', greater]] as [label, cards] (label)}
			{#if (cards as string[]).length > 0}
				<div>
					<p class="ct-zone-label">{label} — {(cards as string[]).length}</p>
					<div class="hand">
						{#each cards as string[] as card (card)}
							<Card
								face={faces[card] ?? null}
								greaterDoom={faces[card]?.greaterDoom ?? false}
								selected={selected?.card === card && selected?.zone === zone.id}
								lit={lit.includes(card)}
								pick={{ zone: zone.id, card }}
								{onSelect}
							/>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>
{:else}
	<div class="hand">
		{#each sorted as card (card)}
			<Card
				face={faces[card] ?? null}
				selected={selected?.card === card && selected?.zone === zone.id}
				lit={lit.includes(card)}
				pick={{ zone: zone.id, card }}
				{onSelect}
			/>
		{/each}
	</div>
{/if}

<style>
	.hand {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.hand__groups {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.hand__hidden {
		color: var(--ct-quiet);
		margin: 0;
	}
</style>
