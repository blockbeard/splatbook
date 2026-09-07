<!--
	What this card is for, and which cards would do.

	Both directions of one question. Pick a card and the actions it pays for lift;
	pick an action and the cards that pay for it lift. Neither filters the other —
	everything stays selectable, because a menu that lists only legal choices
	refuses a play exactly as a rule would, and the GM rules on things the book
	never anticipated.

	Hence the last entry, always: something else, with a line to type it in.
-->
<script lang="ts">
	import { actionsForCard, type Action, type ActionCatalogue } from './actions';
	import type { CardFace, FaceIndex } from './faces';

	let {
		catalogue,
		faces,
		heldCard = null,
		chosen = $bindable(),
		custom = $bindable(),
		asGm = false
	}: {
		catalogue: ActionCatalogue;
		faces: FaceIndex;
		/** The card picked up, if any. The other direction is the parent's, since
		 * it owns the hand and does the lighting. */
		heldCard?: string | null;
		chosen: Action | null;
		custom: string;
		asGm?: boolean;
	} = $props();

	const held = $derived<CardFace | null>(heldCard ? (faces[heldCard] ?? null) : null);

	/** Everything, in book order, with what the held card pays for marked. */
	const offer = $derived(
		held
			? actionsForCard(catalogue, held, { asGm })
			: { fits: [] as Action[], rest: [] as Action[] }
	);
	const listed = $derived(
		held
			? [...offer.fits, ...offer.rest]
			: [
					...Object.values(catalogue.bySuit).flat(),
					...catalogue.anySuit,
					...(asGm ? catalogue.gmOnly : [])
				]
	);
	const fitsThisCard = (action: Action) => offer.fits.includes(action);
</script>

<div class="actions">
	<p class="ct-zone-label">
		{#if held}
			<!-- Majors are named "The Magician"; minors "Ace of Cups". Prefixing
			     "the" unconditionally gave "the The Magician". -->
			What {held.name.startsWith('The ') ? '' : 'the '}{held.name} pays for
		{:else}
			Actions
		{/if}
	</p>

	<ul>
		{#each listed as action (action.id)}
			<li>
				<button
					type="button"
					class:fits={held ? fitsThisCard(action) : false}
					class:chosen={chosen?.id === action.id}
					onclick={() => (chosen = chosen?.id === action.id ? null : action)}
				>
					{action.name}
				</button>
			</li>
		{/each}
		<li>
			<label class="actions__else">
				Something else
				<input
					bind:value={custom}
					placeholder="whatever you just ruled"
					autocomplete="off"
					oninput={() => (chosen = null)}
				/>
			</label>
		</li>
	</ul>

	{#if catalogue.free.length > 0}
		<p class="actions__free">
			No card needed: {catalogue.free
				.map((a) => a.name)
				.join(', ')
				.toLowerCase()}.
		</p>
	{/if}
</div>

<style>
	.actions {
		min-inline-size: 12rem;
	}
	ul {
		list-style: none;
		margin: 0.35rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	button {
		background: none;
		border: 1px solid var(--ct-rule);
		border-radius: 3px;
		color: var(--ct-quiet);
		font: inherit;
		font-size: 0.85rem;
		padding: 0.25rem 0.55rem;
		min-block-size: 2.2rem;
		cursor: pointer;
	}
	/* What the held card pays for. Lifted, not isolated: everything else is
	   still right there and still works. */
	button.fits {
		border-color: var(--ct-mark);
		color: inherit;
	}
	button.chosen {
		background: var(--ct-mark);
		color: var(--ct-card);
		border-color: var(--ct-mark);
	}
	.actions__else {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.85rem;
		color: var(--ct-quiet);
	}
	.actions__else input {
		background: transparent;
		border: 1px solid var(--ct-rule);
		border-radius: 3px;
		color: inherit;
		font: inherit;
		padding: 0.25rem 0.4rem;
		min-block-size: 2.2rem;
		inline-size: 10rem;
	}
	.actions__free {
		margin: 0.5rem 0 0;
		font-size: 0.78rem;
		color: var(--ct-quiet);
	}
</style>
