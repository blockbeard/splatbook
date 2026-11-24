<!--
	What this card is for, and which cards would do.

	Both directions of one question. Pick a card and the actions it pays for lift;
	pick an action and the cards that pay for it lift. Neither filters the other —
	everything stays selectable, because a menu that lists only legal choices
	refuses a play exactly as a rule would, and the GM rules on things the book
	never anticipated.

	Hence the last entry, always: something else, with a line to type it in.

	Under the menu, one line says what an action does (phase 31): the action
	under the pointer or the keyboard, or else the one chosen. Not a tooltip,
	because on a touch screen a tap already *chooses* an action and cannot also
	mean "explain" — so choosing is how an iPad reads a rule. "Read the rule"
	appears for the chosen action only, so it stays put while the mouse travels
	down to it across the other buttons. Each button also carries its own
	summary as its accessible description, which is what a screen reader hears
	on focus; the visible line is for eyes and is hidden from assistive tech so
	the same words are not read twice.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
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

	/** The action under the pointer or the keyboard, if any. Local and fleeting. */
	let preview = $state<Action | null>(null);
	const explained = $derived(preview ?? chosen);
	const describedBy = (action: Action) => `action-summary-${action.id}`;
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
					class="ct-btn ct-btn--quiet"
					class:fits={held ? fitsThisCard(action) : false}
					class:chosen={chosen?.id === action.id}
					aria-describedby={action.summary ? describedBy(action) : undefined}
					onclick={() => (chosen = chosen?.id === action.id ? null : action)}
					onpointerenter={() => (preview = action)}
					onpointerleave={() => (preview = null)}
					onfocus={() => (preview = action)}
					onblur={() => (preview = null)}
				>
					{action.name}
				</button>
				{#if action.summary}
					<!-- `hidden`, not visually hidden: a description may point at a hidden
					     element, and this way browse mode does not read all 25 inline. -->
					<span hidden id={describedBy(action)}>{action.summary}</span>
				{/if}
			</li>
		{/each}
		<li>
			<label class="actions__else">
				Something else
				<input
					class="ct-field"
					bind:value={custom}
					placeholder="whatever you just ruled"
					autocomplete="off"
					oninput={() => (chosen = null)}
				/>
			</label>
		</li>
	</ul>

	<p class="actions__rule" aria-hidden="true">
		{#if explained?.summary}
			<span class="actions__rule-name">{explained.name}.</span>
			{explained.summary}
		{:else}
			<span class="actions__rule-hint">Point at an action, or choose one, to see what it does.</span
			>
		{/if}
	</p>
	{#if chosen?.rule}
		<!-- Outside the aria-hidden line: the link is a control and must stay
		     reachable. A new tab, so the table keeps its place mid-fight. -->
		<a
			class="actions__link"
			href={resolve('/[game=game]/reference/[section]', { game: 'hmtw', section: chosen.rule })}
			target="_blank"
			rel="noopener"
			>Read the rule: {chosen.name}<span class="sr-only"> (opens in a new tab)</span></a
		>
	{/if}

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
	/* The quiet tier, twenty-three times: this is a reference you read, not a
	   panel you drive, and its weight comes off through ink and type rather than
	   through a fainter border — the border is the 3:1 boundary 1.4.11 asks of a
	   control. */
	button {
		padding-inline: 0.6rem;
	}
	/* What the held card pays for. Lifted, not isolated: everything else is
	   still right there and still works. */
	button.fits {
		border-color: var(--ct-mark);
		color: var(--ct-mark);
	}
	button.chosen {
		background: var(--ct-mark);
		/*
		 * The room's colour, not the card's.
		 *
		 * This was `--ct-card`, and in dark mode the mark *is* the card — both
		 * `#e9e7e2` — so a chosen action was bone lettering on a bone fill at
		 * 1:1. Invisible, and shipped.
		 */
		color: var(--ct-table);
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
	/*
	 * A fixed place, a reserved height: the line changes as the pointer moves,
	 * and a box that grew and shrank with it would jog the hand and the menu
	 * under the cursor — the reflow phase 29 already had to take out once.
	 */
	.actions__rule {
		margin: 0.6rem 0 0;
		max-inline-size: 40rem;
		min-block-size: 3.2em;
		font-family: 'IM Fell English', Georgia, serif;
		line-height: 1.45;
	}
	.actions__rule-name {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		color: var(--ct-mark);
	}
	.actions__rule-hint {
		color: var(--ct-quiet);
		font-size: 0.85rem;
	}
	.actions__link {
		display: inline-flex;
		align-items: center;
		min-block-size: 2.75rem;
		color: var(--ct-mark);
		font-size: var(--ct-step-label);
		/* Underlined: on a monochrome table, ink alone cannot say "link". */
		text-decoration: underline;
	}
	.actions__free {
		margin: 0.5rem 0 0;
		font-size: 0.78rem;
		color: var(--ct-quiet);
	}
</style>
