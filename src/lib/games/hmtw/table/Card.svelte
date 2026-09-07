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
		value: number;
	}

	let {
		face = null,
		faceDown = false,
		declared = null,
		sideways = false,
		selected = false,
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
		class:ct-card--greater={greaterDoom}
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
			<span class="ct-card__rank">{face.rank}</span>
			{#if face.glyph}
				<span class="ct-glyph ct-card__suit" style="--ct-glyph: url({face.glyph})"></span>
			{/if}
			<span class="ct-card__foot">{face.value}</span>
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
