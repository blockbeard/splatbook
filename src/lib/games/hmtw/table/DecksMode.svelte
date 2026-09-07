<!--
	Decks mode: the two decks, their discards, and the seats around them.

	This is most of a Crawl session. A Test of Fate is a card off the top of the
	player deck, and that is the whole interaction — so the mode that does only
	that is worth shipping on its own, before any of the Challenge machinery
	exists.

	The discard is a *source* as well as a destination, which is the one thing
	here that is not obvious: ch.5's High Chant picks inspiration cards out of
	the minor arcana discard pile and hands them round, so you have to be able to
	reach into it and take a named card. That is also the only place a command
	may name a card, because it is the only pile whose faces everyone can see.
-->
<script lang="ts">
	import Pile from './Pile.svelte';
	import SeatRail from './SeatRail.svelte';
	import Card from './Card.svelte';
	import type { FaceIndex } from './faces';
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import { createSelection, type Pick } from '$lib/card-table/selection';

	let {
		table,
		seats,
		faces,
		mySeatId,
		busy = false,
		onCommand
	}: {
		table: ProjectedTable;
		seats: { id: string; name: string; status: string; isGm: boolean }[];
		faces: FaceIndex;
		mySeatId: string | null;
		busy?: boolean;
		onCommand: (command: unknown) => void;
	} = $props();

	let selectedPick = $state<Pick | null>(null);
	const selection = createSelection(() => (selectedPick = selection.selected));

	let openPile = $state<string | null>(null);
	let zoomed = $state<string | null>(null);

	const isGm = $derived(mySeatId !== null && table.gmSeat === mySeatId);
	const zone = (id: string) => table.zones[id];

	function select(pick: Pick) {
		selection.select(pick);
	}

	function drop(zoneId: string) {
		const move = selection.place(zoneId);
		if (move) onCommand({ type: 'move', from: move.from, to: move.to });
	}

	/** The Fool has come out, so both decks want shuffling at the end of the round. */
	const foolIsOut = $derived(table.round.foolDrawn);
</script>

<div class="decks">
	<SeatRail
		{table}
		{seats}
		{faces}
		{mySeatId}
		{isGm}
		selected={selectedPick}
		onSelect={select}
		onDrop={drop}
	/>

	<div class="decks__table">
		{#if foolIsOut}
			<p class="prompt">
				The Fool is out. Both decks are shuffled at the end of the round.
				{#if isGm}
					<button type="button" onclick={() => onCommand({ type: 'reshuffle', deck: 'player' })}>
						Shuffle the player deck
					</button>
					<button type="button" onclick={() => onCommand({ type: 'reshuffle', deck: 'gm' })}>
						Shuffle the GM deck
					</button>
				{/if}
			</p>
		{/if}

		<div class="decks__piles">
			{#each [['player', 'Player deck', 'Minor arcana discard'], ['gm', 'GM deck', 'Major arcana discard']] as [deck, deckLabel, discardLabel] (deck)}
				<div class="decks__pair">
					<Pile
						zone={zone(`deck:${deck}`)}
						label={deckLabel}
						{faces}
						selected={selectedPick}
						droppable={selectedPick !== null}
						onSelect={select}
						onDrop={drop}
					/>
					<button
						type="button"
						class="decks__flip"
						disabled={busy || zone(`deck:${deck}`).count === 0}
						onclick={() =>
							onCommand({ type: 'move', from: { zone: `deck:${deck}` }, to: `discard:${deck}` })}
					>
						Turn one over
					</button>
					<Pile
						zone={zone(`discard:${deck}`)}
						label={discardLabel}
						{faces}
						selected={selectedPick}
						droppable={selectedPick !== null}
						onSelect={select}
						onDrop={drop}
						onOpen={(id) => (openPile = id)}
					/>
					{#if isGm}
						<button
							type="button"
							class="decks__shuffle"
							onclick={() => onCommand({ type: 'reshuffle', deck })}
						>
							Shuffle the discard back in
						</button>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

{#if openPile}
	{@const pile = zone(openPile)}
	<div class="pane">
		<div class="pane__head">
			<h2 class="ct-zone-label">{pile.count} cards</h2>
			<p class="pane__hint">
				Pick one up, then click a seat's Inspiration slot to give it to them.
			</p>
			<button type="button" onclick={() => (openPile = null)}>Close</button>
		</div>
		<div class="pane__cards">
			{#each pile.cards ?? [] as card (card)}
				<Card
					face={faces[card] ?? null}
					greaterDoom={faces[card]?.greaterDoom ?? false}
					selected={selectedPick?.card === card}
					pick={{ zone: pile.id, card }}
					onSelect={select}
					onContext={() => (zoomed = card)}
				/>
			{/each}
		</div>
	</div>
{/if}

{#if zoomed}
	{@const face = faces[zoomed]}
	<button type="button" class="zoom" onclick={() => (zoomed = null)} aria-label="Close">
		<span class="zoom__card">
			<span class="zoom__rank">{face?.rank}</span>
			<span class="zoom__name">{face?.name}</span>
		</span>
	</button>
{/if}

<style>
	.decks {
		display: flex;
		gap: 2rem;
		align-items: flex-start;
		flex-wrap: wrap;
		padding: 1.25rem;
	}
	.decks__table {
		flex: 1 1 22rem;
	}
	.decks__piles {
		display: flex;
		gap: 2.5rem;
		flex-wrap: wrap;
	}
	.decks__pair {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}
	.decks__flip,
	.decks__shuffle,
	.prompt button {
		background: none;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: var(--ct-card);
		font: inherit;
		font-size: 0.85rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		/* Comfortably over the 44px touch floor with the padding above. */
		min-block-size: 2.4rem;
	}
	.decks__flip:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.prompt {
		border: 1px solid var(--ct-light-soft);
		border-radius: 4px;
		padding: 0.6rem 0.8rem;
		margin: 0 0 1.25rem;
		color: var(--ct-light);
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.pane {
		position: fixed;
		inset-block-end: 0;
		inset-inline: 0;
		max-block-size: 60vh;
		overflow: auto;
		background: var(--ct-table-low);
		border-block-start: 1px solid var(--ct-rule-strong);
		padding: 1rem;
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
		color: rgb(236 231 219 / 55%);
	}
	.pane__head button {
		margin-inline-start: auto;
		background: none;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: var(--ct-card);
		font: inherit;
		padding: 0.25rem 0.75rem;
		cursor: pointer;
	}
	.pane__cards {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin-block-start: 0.75rem;
	}
	.zoom {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 78%);
		border: 0;
		display: grid;
		place-items: center;
		cursor: zoom-out;
	}
	.zoom__card {
		background: var(--ct-card);
		color: var(--ct-card-ink);
		padding: 2rem 2.5rem;
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
