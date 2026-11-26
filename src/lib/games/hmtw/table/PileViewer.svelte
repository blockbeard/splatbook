<!--
	A pile opened to look through: the discard, card by card.

	Shared by Decks mode and the Challenge. The first live test (25 November
	2026) found a Challenge's discards could not be opened at all, which is
	where a player most wants to see what has gone.

	Not a modal: the table behind it stays usable, so a card picked up here can
	be put down anywhere. Focus moves into it when it opens, and the parent puts
	focus back when it closes. Escape is the parent's too, so one key backs out
	in order — the zoom, then the pane, then whatever is held.
-->
<script lang="ts">
	import Card from './Card.svelte';
	import type { FaceIndex } from './faces';
	import type { ProjectedZone } from '$lib/card-table/client-types';
	import type { Pick } from '$lib/card-table/selection';

	let {
		pile,
		faces,
		selected,
		hint,
		zoomed = $bindable(),
		onSelect,
		onClose
	}: {
		pile: ProjectedZone;
		faces: FaceIndex;
		selected: Pick | null;
		/** What a card picked up here is for, in this mode. */
		hint: string;
		zoomed: string | null;
		onSelect: (pick: Pick) => void;
		onClose: () => void;
	} = $props();

	let paneEl = $state<HTMLElement | null>(null);
	$effect(() => {
		paneEl?.focus();
	});
</script>

<div class="pane" bind:this={paneEl} tabindex="-1" aria-label="{pile.count} cards">
	<div class="pane__head">
		<h2 class="ct-zone-label">{pile.count} cards</h2>
		<p class="pane__hint">{hint}</p>
		<button type="button" class="ct-btn ct-btn--quiet" onclick={onClose}>Close</button>
	</div>
	<div class="pane__cards">
		{#each pile.cards ?? [] as card (card)}
			<div class="pane__card">
				<Card
					face={faces[card] ?? null}
					greaterDoom={faces[card]?.greaterDoom ?? false}
					selected={selected?.card === card}
					pick={{ zone: pile.id, card }}
					{onSelect}
					onContext={() => (zoomed = card)}
				/>
				<!-- A visible control, because nothing may be reachable only by
				     right-click. The context gesture is the shortcut, not the way. -->
				<button type="button" class="pane__zoom" onclick={() => (zoomed = card)}>
					Look closer
				</button>
			</div>
		{/each}
	</div>
</div>

{#if zoomed}
	{@const face = faces[zoomed]}
	<button type="button" class="zoom" onclick={() => (zoomed = null)} aria-label="Close">
		<span class="zoom__card">
			{#if face?.art}
				<!-- The plates are 360px wide, which is five times what the table
				     draws. This is the view that spends the rest of them, and it was
				     the argument for having pictures at all — a card you can
				     actually look at. -->
				<img class="zoom__art" src={face.art} alt="" />
			{/if}
			<span class="zoom__name">{face?.name}</span>
			<!-- The value alone: "X of Wands" already contains the rank, and saying
			     it twice was the same redundancy the card face drops. -->
			<span class="zoom__rank">{face?.value}</span>
		</span>
	</button>
{/if}

<style>
	.pane {
		position: fixed;
		inset-block-end: 0;
		inset-inline: 0;
		max-block-size: 60vh;
		overflow: auto;
		background: var(--ct-table-low);
		border-block-start: 1px solid var(--ct-rule-strong);
		padding: 1rem;
		/* Over the pinned guide line (z-index 2 in ChallengeMode). */
		z-index: 3;
	}
	.pane__head {
		display: flex;
		gap: 1rem;
		align-items: baseline;
		flex-wrap: wrap;
	}
	.pane__hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--ct-quiet);
	}
	.pane__head button {
		margin-inline-start: auto;
	}
	.pane__cards {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-block-start: 0.75rem;
	}
	.pane__card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}
	.pane__zoom {
		background: none;
		border: 0;
		padding: 0.25rem;
		font: inherit;
		font-size: 0.75rem;
		color: var(--ct-quiet);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.zoom {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 78%);
		border: 0;
		display: grid;
		place-items: center;
		cursor: zoom-out;
		/* Over the pane it opened from, and over the pinned guide line, which
		   used to print across the top of the card being looked at. */
		z-index: 4;
	}
	.zoom__art {
		inline-size: min(62vw, 20rem);
		block-size: auto;
		border: 1px solid var(--ct-card-ink);
		mix-blend-mode: multiply;
	}
	.zoom__card {
		background: var(--ct-card);
		color: var(--ct-card-ink);
		padding: 1.25rem 1.25rem 1rem;
		border-radius: 4px;
		display: grid;
		gap: 0.5rem;
		text-align: center;
	}
	.zoom__rank {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-size: 2.5rem;
	}
	.zoom__name {
		font-family: 'IM Fell English', Georgia, serif;
	}
</style>
