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
		canAct = false,
		busy = false,
		onCommand
	}: {
		table: ProjectedTable;
		seats: { id: string; name: string; status: string; isGm: boolean }[];
		faces: FaceIndex;
		mySeatId: string | null;
		/** Whether this viewer holds an admitted seat. Watchers may look, not touch. */
		canAct?: boolean;
		busy?: boolean;
		onCommand: (command: unknown) => void;
	} = $props();

	let selectedPick = $state<Pick | null>(null);
	const selection = createSelection(() => (selectedPick = selection.selected));

	let openPile = $state<string | null>(null);
	let zoomed = $state<string | null>(null);

	const isGm = $derived(canAct && table.gmSeat === mySeatId);
	/** Nothing is offered to somebody who cannot use it. A control that refuses
	 * when pressed is worse than one that is plainly not for you. */
	const locked = $derived(busy || !canAct);
	const zone = (id: string) => table.zones[id];

	function select(pick: Pick) {
		if (!canAct) return;
		selection.select(pick);
	}

	function drop(zoneId: string) {
		if (!canAct) return;
		const move = selection.place(zoneId);
		if (move) onCommand({ type: 'move', from: move.from, to: move.to });
	}

	/** The Fool has come out, so both decks want shuffling at the end of the round. */
	const foolIsOut = $derived(table.round.foolDrawn);

	/**
	 * Focus follows the pane, and comes back when it goes.
	 *
	 * The pane is appended after everything else in the DOM, so leaving focus on
	 * the pile that opened it meant a keyboard user had to tab through the whole
	 * rest of the table to reach the cards they had just asked to look at. It is
	 * not a modal — the table behind it stays usable, which is deliberate, so
	 * this moves focus rather than trapping it.
	 */
	let paneEl = $state<HTMLElement | null>(null);
	let openedFrom: HTMLElement | null = null;

	function openPileFrom(id: string, event?: Event) {
		openedFrom = (event?.currentTarget as HTMLElement) ?? (document.activeElement as HTMLElement);
		openPile = id;
	}

	function closePane() {
		openPile = null;
		openedFrom?.focus();
		openedFrom = null;
	}

	$effect(() => {
		if (openPile && paneEl) paneEl.focus();
	});

	function onKey(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		// One key, in the order you would expect to back out: close the zoom,
		// then the pane, then put down whatever you are holding.
		if (zoomed) zoomed = null;
		else if (openPile) closePane();
		else selection.clear();
	}
</script>

<svelte:window onkeydown={onKey} />

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

		{#if zone('fate').count > 0}
			{@const drawn = zone('fate').cards ?? []}
			<section class="fate">
				<p class="ct-zone-label">
					Turned over — {drawn.reduce((n, c) => n + (faces[c]?.value ?? 0), 0)}
				</p>
				<div class="fate__cards">
					{#each drawn as card (card)}
						<Card
							face={faces[card] ?? null}
							greaterDoom={faces[card]?.greaterDoom ?? false}
							selected={selectedPick?.card === card}
							pick={{ zone: 'fate', card }}
							onSelect={select}
						/>
					{/each}
				</div>
				<p class="fate__note">
					Card values only. Your attribute, favour and Resolve are yours to add.
				</p>
				<button type="button" onclick={() => onCommand({ type: 'clear-fate' })}>
					Into the discard
				</button>
			</section>
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
						disabled={locked || zone(`deck:${deck}`).count === 0}
						onclick={() =>
							onCommand({
								type: 'move',
								from: { zone: `deck:${deck}` },
								// Onto the table, not into the discard. A card that vanished
								// the instant it landed meant nobody could see what a test of
								// fate came to, and pushing fate adds a second card to the
								// first.
								to: 'fate'
							})}
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
						onOpen={(id) => openPileFrom(id)}
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
	<div class="pane" bind:this={paneEl} tabindex="-1" aria-label="{pile.count} cards">
		<div class="pane__head">
			<h2 class="ct-zone-label">{pile.count} cards</h2>
			<p class="pane__hint">
				Pick one up, then click a seat's Inspiration slot to give it to them.
			</p>
			<button type="button" onclick={closePane}>Close</button>
		</div>
		<div class="pane__cards">
			{#each pile.cards ?? [] as card (card)}
				<div class="pane__card">
					<Card
						face={faces[card] ?? null}
						greaterDoom={faces[card]?.greaterDoom ?? false}
						selected={selectedPick?.card === card}
						pick={{ zone: pile.id, card }}
						onSelect={select}
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
	.fate {
		border: 1px solid var(--ct-rule-strong);
		border-radius: 4px;
		padding: 0.75rem;
		margin-block-end: 1.25rem;
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
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.3rem 0.7rem;
		cursor: pointer;
		/* Comfortably over the 44px touch floor with the padding above. */
		min-block-size: 2.75rem;
	}
	.decks__flip:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.prompt {
		border: 1px solid var(--ct-rule-strong);
		border-radius: 4px;
		padding: 0.6rem 0.8rem;
		margin: 0 0 1.25rem;
		color: var(--ct-mark);
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
		color: var(--ct-quiet);
	}
	.pane__head button {
		margin-inline-start: auto;
		background: none;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: inherit;
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
