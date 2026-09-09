<!--
	Who a seat is, wherever you meet them.

	Decks mode drew this as a rail entry and the Challenge drew it again as a
	section heading, from two sets of rules that had drifted apart: the Challenge
	never said which combatant was *yours*, and never said how many cards anyone
	was holding, though both are public and both matter in a fight.

	The two modes still lay out differently, and should — a rail is 12rem wide
	and a Challenge seat carries an initiative card, a facedown slot and a played
	row that grows without limit, so no rail was ever going to hold one. What is
	shared is the person, not the space around them.

	Phrasing content only, so it is valid inside the `<li>` the rail uses and the
	`<h3>` the Challenge uses. Its styles live in table.css beside the buttons',
	for the same reason: two callers, one look.
-->
<script lang="ts">
	let {
		name,
		isGm = false,
		mine = false,
		hand = null
	}: {
		name: string;
		isGm?: boolean;
		/** This seat is the viewer's. */
		mine?: boolean;
		/** How many cards they hold. Public — you can count a hand across a real
		 * table — but never *which*. Null leaves it out entirely. */
		hand?: number | null;
	} = $props();
</script>

<span class="ct-seat">
	<span class="ct-seat__name">{name}</span>
	{#if isGm}<span class="ct-seat__tag">GM</span>{/if}
	{#if mine}<span class="ct-seat__tag ct-seat__tag--mine">you</span>{/if}
	{#if hand !== null}<span class="ct-seat__hand">{hand} in hand</span>{/if}
</span>
