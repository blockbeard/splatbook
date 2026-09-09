<!--
	One card on the table.

	It renders one of three things, and which one is decided entirely by what the
	projection gave us — never by a prop a caller could get wrong:

	  a face      the card's identity arrived, so this seat may see it
	  a back      it did not, so this seat may not
	  a back with a mark  it did, and it is still face down, and it is ours

	That last case is the whole design problem of a card table, and the reason
	the mark sits *on the back* rather than turning the card over: its owner has
	to know both what it is and that nobody else does. A card that looked face-up
	to its holder would leave them guessing about the one thing they must never
	guess about.

	The declared action ("Riposte") is not on the card. It hangs beneath it,
	because ch.7 makes the intent public while the value stays private, and
	printing public information on a hidden object is the wrong place for it.
-->
<script lang="ts">
	import { isContextGesture, type Pick } from '$lib/card-table/selection';

	interface CardFace {
		id: string;
		name: string;
		/** Rank as the book prints it: "Ace", "VII", "King", or a major's numeral. */
		rank: string;
		/** Pack-relative suit glyph, absent for a major. */
		glyph?: string;
		/** The card's picture, when the pack carries one. */
		art?: string;
		value: number;
	}

	let {
		face = null,
		faceDown = false,
		declared = null,
		sideways = false,
		selected = false,
		lit = false,
		greaterDoom = false,
		pick,
		onSelect,
		onContext
	}: {
		/** The card, when this viewer is entitled to it. Null means they are not. */
		face?: CardFace | null;
		faceDown?: boolean;
		/** The publicly declared action, shown to everyone. */
		declared?: string | null;
		sideways?: boolean;
		selected?: boolean;
		/** This card would pay for the action currently picked. A hint, not a gate. */
		lit?: boolean;
		greaterDoom?: boolean;
		pick: Pick;
		onSelect?: (pick: Pick) => void;
		onContext?: (pick: Pick, event: MouseEvent) => void;
	} = $props();

	/** Ours, and still hidden from everyone else. */
	const mine = $derived(faceDown && face !== null);

	const label = $derived(
		faceDown
			? face
				? `${face.name}, face down${declared ? `, declared ${declared}` : ''}`
				: `Face-down card${declared ? `, declared ${declared}` : ''}`
			: (face?.name ?? 'Card')
	);

	function activate(event: MouseEvent) {
		if (isContextGesture(event)) {
			event.preventDefault();
			onContext?.(pick, event);
			return;
		}
		onSelect?.(pick);
	}
</script>

<div class="ct-card-slot">
	<button
		type="button"
		class="ct-card"
		class:ct-card--down={faceDown}
		class:ct-card--sideways={sideways}
		class:ct-card--selected={selected}
		class:ct-card--lit={lit}
		class:ct-card--greater={greaterDoom}
		class:ct-card--pictured={!faceDown && !!face?.art}
		aria-label={label}
		aria-pressed={selected}
		onclick={activate}
		oncontextmenu={activate}
	>
		{#if faceDown}
			{#if mine && face}
				<!-- Yours to read, and unmistakably still face down. -->
				<span class="ct-card__mine">
					{face.rank}
					{#if face.glyph}
						<span class="ct-glyph" style="--ct-glyph: url({face.glyph})"></span>
					{/if}
				</span>
			{/if}
		{:else if face}
			{#if face.art}
				<!--
					The picture, and under it the two things the rules ask of a card:
					what it is worth, and which suit pays for what. Not the rank — on a
					minor the rank *is* the value, and on a court card the picture says
					"knight" better than the word does.

					Decorative, so no alt text: the button around it is already named
					"Knight of Wands", and a screen reader repeating that as an image
					description would say it twice.
				-->
				<!-- Lazy, because a discard pile opened in the pane renders every card
				     in it at once, and thirty plates is a megabyte nobody asked for. -->
				<img class="ct-card__art" src={face.art} alt="" loading="lazy" decoding="async" />
				<span class="ct-card__band">
					<span class="ct-card__value">{face.value}</span>
					{#if face.glyph}
						<span class="ct-glyph ct-card__band-suit" style="--ct-glyph: url({face.glyph})"></span>
					{/if}
				</span>
			{:else}
				<!-- No plate in the pack: the face this table had before there were
				     pictures, which is still perfectly playable. -->
				<span class="ct-card__rank">{face.rank}</span>
				{#if face.glyph}
					<span class="ct-glyph ct-card__suit" style="--ct-glyph: url({face.glyph})"></span>
				{/if}
				<span class="ct-card__foot">{face.value}</span>
			{/if}
		{/if}
	</button>

	{#if declared}
		<p class="ct-declared">{declared}</p>
	{/if}
</div>

<style>
	.ct-card-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	/* The card is a button; strip the browser's idea of one. */
	:global([data-game='hmtw'] .ct-card) {
		appearance: none;
		font: inherit;
		text-align: start;
	}
</style>
