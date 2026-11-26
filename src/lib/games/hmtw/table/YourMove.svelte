<!--
	What you can do now — the round, one step at a time (phase 32).

	The first live test (25 November 2026) had every card movable by everyone
	and nothing to say what a card was for: "being able to play your card
	anywhere is confusing", "in initiative phase you should click a card then
	click a button to confirm it as your initiative", "closing minor actions
	should reveal everyone's card and what they are doing". So this panel offers
	exactly the moves the step allows, for whoever you act for — your own seat,
	or every enemy group when you run the table — and nothing else:

	- Initiative: pick a card, then Play as initiative.
	- Your turn: choose the action, a card, who at; Play it, Ready it, Guard, or
	  skip.
	- Minor actions: put one down face down, ready one, or pass.
	- Any time a card is on the table: the Fool or an interrupt, out of turn;
	  use a readied card; show your initiative when you are attacked; take back
	  what nobody has answered yet.

	It never checks a value, a suit or a target. That is still the table's to
	judge.
-->
<script lang="ts">
	import Actions from './Actions.svelte';
	import type { Action, ActionCatalogue } from './actions';
	import type { FaceIndex } from './faces';
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import type { Pick } from '$lib/card-table/selection';
	import { creatureLabel } from '../engine/creatures';

	let {
		table,
		seats,
		faces,
		catalogue,
		mySeatId,
		runs,
		busy,
		selected,
		chosen = $bindable(),
		custom = $bindable(),
		extras = $bindable(),
		collecting = $bindable(),
		onCommand,
		onDone,
		onPick
	}: {
		table: ProjectedTable;
		seats: readonly { id: string; name: string; status: string; isGm: boolean }[];
		faces: FaceIndex;
		catalogue: ActionCatalogue;
		mySeatId: string;
		/** Whether you run the table, and so act for the enemy groups. */
		runs: boolean;
		busy: boolean;
		/** The card picked up from your hand, if any. */
		selected: Pick | null;
		chosen: Action | null;
		custom: string;
		/**
		 * Extra cards played with the first: a greater doom with its lesser, the
		 * Fool's partner. Collected by the parent, which owns the hand.
		 */
		extras: Pick[];
		/** Whether a pick from the hand adds to `extras` rather than choosing the card. */
		collecting: boolean;
		onCommand: (command: unknown) => void;
		/** Put down whatever is held, once a command has used it. */
		onDone: () => void;
		/** Pick a card up from your hand, as a click on it would. */
		onPick?: (pick: Pick) => void;
	} = $props();

	const step = $derived(table.round.step);
	const isGmSeat = $derived(table.gmSeat === mySeatId);
	const hand = $derived(`seat:${mySeatId}:hand`);

	/** Whoever you act for: your seat, unless it is the GM's; and the groups, if you run the table. */
	const mine = $derived([
		...(isGmSeat ? [] : [mySeatId]),
		...(runs ? table.opponents.filter((o) => o.count > 0).map((o) => o.id) : [])
	]);
	const nameOf = (id: string) =>
		seats.find((s) => s.id === id)?.name ??
		table.opponents.find((o) => o.id === id)?.name ??
		creatureLabel(table.opponents, id) ??
		'Somebody';
	const forWhom = (id: string) => (id === mySeatId ? 'you' : nameOf(id));

	/** The card in hand, picked up. */
	const card = $derived(selected?.zone === hand ? selected : null);
	/** What it is for: a menu choice, or the player's own words. */
	const label = $derived((custom.trim() || chosen?.name || '').slice(0, 60));

	let target = $state('');
	/** Which of your holders is acting, when there is more than one. */
	let acting = $state('');

	function done() {
		extras = [];
		collecting = false;
		target = '';
		chosen = null;
		custom = '';
		onDone();
	}

	function send(command: unknown) {
		onCommand(command);
		done();
	}

	/* ---- initiative ---- */
	const needInitiative = $derived(
		step === 'initiative' ? table.waitingOn.filter((h) => mine.includes(h)) : []
	);
	const hasInitiative = (h: string) =>
		(table.zones[h === mySeatId ? `seat:${h}:initiative` : `opponent:${h}:initiative`]?.count ??
			0) > 0;

	/* ---- the turn ---- */
	const upMine = $derived(step === 'turn' ? table.upNow.filter((h) => mine.includes(h)) : []);
	const minorMine = $derived(
		step === 'minor' ? table.waitingOn.filter((h) => mine.includes(h)) : []
	);
	const actingNow = $derived(
		upMine.includes(acting)
			? acting
			: minorMine.includes(acting)
				? acting
				: (upMine[0] ?? minorMine[0] ?? '')
	);

	/** How the chosen action's card goes down: face up, readied, or as your initiative. */
	const mode = $derived(
		chosen?.play === 'ready' ? 'ready' : chosen?.play === 'initiative' ? 'guard' : 'play'
	);

	const targets = $derived([
		...seats
			.filter((s) => s.status === 'admitted' && !s.isGm && s.id !== table.gmSeat)
			.map((s) => ({ id: s.id, name: s.name })),
		...table.opponents.flatMap((o) =>
			o.creatures
				.filter((c) => !c.down)
				.map((c) => ({ id: c.id, name: creatureLabel(table.opponents, c.id) ?? o.name }))
		)
	]);

	/* ---- taking back, showing, readied ---- */
	const takeBackable = $derived(
		mine.filter((h) => {
			if (step === 'initiative') return hasInitiative(h);
			// A minor action put down, or readied at this number, until the
			// minors turn over (Card Table Test 3, phase 33).
			const minorZone = h === mySeatId ? `seat:${h}:minor` : `opponent:${h}:minor`;
			if (
				step === 'minor' &&
				table.round.answered.includes(h) &&
				((table.zones[minorZone]?.count ?? 0) > 0 || (table.round.readiedNow ?? []).includes(h))
			)
				return true;
			const open = step === 'turn' || (step === 'minor' && table.round.answered.length === 0);
			return (
				open &&
				Object.values(table.plays).some(
					(p) => p.by === h && p.kind === 'turn' && p.number === table.round.count
				)
			);
		})
	);
	const myReadied = $derived(
		mine.filter(
			(h) =>
				(table.zones[h === mySeatId ? `seat:${h}:facedown` : `opponent:${h}:facedown`]?.count ??
					0) > 0
		)
	);
	// Only once the count is running: before it, nobody can be acting against
	// you, and the button only invited a mistake (second live test).
	const canShow = $derived(
		!isGmSeat &&
			(step === 'turn' || step === 'minor' || step === 'resolve') &&
			hasInitiative(mySeatId) &&
			!table.round.shown.includes(mySeatId)
	);
	const midRound = $derived(step === 'turn' || step === 'minor' || step === 'resolve');

	/** Whether the action picker is up for a turn or a minor action of yours. */
	const picking = $derived(
		needInitiative.length === 0 && (upMine.length > 0 || minorMine.length > 0)
	);

	/*
	 * The Fool, up front (phase 33). It worked in Session 14, under the closed
	 * "Out of turn", but the GM didn't remember it existed. A player's hand holds
	 * minors and the one major the player deck borrows, so a card with no suit in
	 * it is the Fool; the GM's hand is all majors and has none.
	 */
	const myFool = $derived(
		isGmSeat ? undefined : (table.zones[hand]?.cards ?? []).find((c) => faces[c] && !faces[c].suit)
	);
	const foolHeld = $derived(!!myFool && card?.card === myFool);
	/** Out of turn stays open once opened, through the turn, its minors and the resolve. */
	let outOpen = $state(false);

	const minorNow = $derived(minorMine.length > 0 && upMine.length === 0);
	/** The bar by the hand: a card picked, and a play for it to send. */
	const barShown = $derived(!!card && (needInitiative.length > 0 || picking));
	const cardName = $derived(card?.card ? (faces[card.card]?.name ?? 'Your card') : '');
	let barHeight = $state(0);

	/*
	 * The bar never covers the hand. The page gains room below it, and when a
	 * card is picked with the hand's bottom under where the bar sits, the page
	 * scrolls just enough to bring the hand clear of it.
	 */
	$effect(() => {
		if (!barShown || barHeight === 0) return;
		const handEl = document.getElementById('my-hand');
		if (!handEl) return;
		const overlap = handEl.getBoundingClientRect().bottom - (window.innerHeight - barHeight);
		if (overlap > 0) window.scrollBy({ top: overlap + 8 });
	});

	function playTheFool() {
		if (!myFool) return;
		extras = [];
		onPick?.({ zone: hand, card: myFool });
		collecting = true;
		outOpen = true;
	}
</script>

<!--
	The one button that sends the picked card: Play as initiative, Play it, Put
	it down or Ready it. Rendered in one place at a time, so there is one thing
	to press: in its place in Your move, or, once a card is picked, in the bar
	pinned to the bottom of the screen (phase 33). Everyone in Session 14 forgot
	to press it, because it sat in Your move, well away from the hand they had
	just tapped.
-->
{#snippet primary()}
	{#if needInitiative.length > 0}
		{#each needInitiative as h (h)}
			<button
				type="button"
				class="ct-btn ct-btn--primary"
				disabled={busy || !card}
				onclick={() => card && send({ type: 'play-initiative', holder: h, from: card })}
			>
				{h === mySeatId ? 'Play as initiative' : `Initiative for ${nameOf(h)}`}
			</button>
		{/each}
	{:else if minorNow}
		{#if chosen?.play !== 'ready'}
			<button
				type="button"
				class="ct-btn ct-btn--primary"
				disabled={busy || !card || !label}
				onclick={() =>
					card &&
					send({
						type: 'declare-minor',
						holder: actingNow,
						from: card,
						label,
						...(target ? { target } : {}),
						// Guard as a minor swaps the initiative when the minors turn
						// over (phase 33): sent from the pack's flag, as a turn's is.
						...(chosen?.play === 'initiative' ? { mode: 'guard' } : {})
					})}>Put it down</button
			>
		{/if}
		{#if chosen?.play === 'ready' || (!chosen && custom.trim())}
			<button
				type="button"
				class={chosen?.play === 'ready' ? 'ct-btn ct-btn--primary' : 'ct-btn'}
				disabled={busy || !card || !label}
				onclick={() => card && send({ type: 'ready-minor', holder: actingNow, from: card, label })}
				>Ready it (keep it)</button
			>
		{/if}
	{:else}
		<button
			type="button"
			class="ct-btn ct-btn--primary"
			disabled={busy || !card || !label}
			onclick={() =>
				card &&
				send({
					type: 'play-turn',
					holder: actingNow,
					from: card,
					...(extras.length > 0 ? { extra: extras } : {}),
					action: label,
					...(target ? { target } : {}),
					mode
				})}
		>
			{mode === 'ready' ? 'Ready it' : mode === 'guard' ? 'Make it my initiative' : 'Play it'}
		</button>
	{/if}
{/snippet}

<section class="move" aria-labelledby="move-heading">
	<h2 id="move-heading" class="ct-zone-label">Your move</h2>

	{#if needInitiative.length > 0}
		<p class="move__how">Pick a card from your hand for initiative, then:</p>
		{#if !barShown}
			<div class="move__buttons">{@render primary()}</div>
		{/if}
	{:else if upMine.length > 0 || minorMine.length > 0}
		{@const minor = minorMine.length > 0 && upMine.length === 0}
		{@const choices = minor ? minorMine : upMine}
		{#if choices.length > 1}
			<label class="move__acting">
				Acting:
				<select class="ct-field" bind:value={acting}>
					{#each choices as h (h)}<option value={h}>{nameOf(h)}</option>{/each}
				</select>
			</label>
		{/if}
		<p class="move__how">
			{#if minor}
				Any minor action{actingNow !== mySeatId ? ` for ${nameOf(actingNow)}` : ''}? Choose it and a
				card — the suit must match, except for the GM — or pass. It stays face down until everyone
				has answered.
			{:else}
				Your turn{actingNow !== mySeatId ? ` for ${nameOf(actingNow)}` : ''}: choose an action and a
				card, then play it — or skip.
			{/if}
		</p>
		<Actions
			{catalogue}
			{faces}
			heldCard={card?.card ?? null}
			bind:chosen
			bind:custom
			asGm={isGmSeat}
			onTurn={!minor}
		/>
		<!-- A minor Attack is aimed at somebody as much as a turn's is (second live
		     test): their initiative turns over when the minor actions do. -->
		<label class="move__target">
			At
			<select class="ct-field" bind:value={target}>
				<option value="">nobody in particular</option>
				{#each targets as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
			</select>
		</label>
		{#if card && extras.length > 0}
			<p class="move__extras">With {extras.length} more card{extras.length === 1 ? '' : 's'}.</p>
		{/if}
		<div class="move__buttons">
			{#if minor}
				<!-- The book readies Riposte, Dodge, Aid Another and Vigilance and keeps
				     them; anything else put down as a minor action is turned over with the
				     rest. So "Ready it" leads for those four and is not offered for an
				     Attack: in the second live test a Riposte was put down and turned over
				     instead of being kept. An action typed in gets both. -->
				{#if !barShown}{@render primary()}{/if}
				<button
					type="button"
					class="ct-btn"
					disabled={busy}
					onclick={() => send({ type: 'pass-minor', holders: [actingNow] })}>Pass</button
				>
				{#if minorMine.length > 1}
					<button
						type="button"
						class="ct-btn ct-btn--quiet"
						disabled={busy}
						onclick={() => send({ type: 'pass-minor', holders: minorMine })}
						>Pass for all of them</button
					>
				{/if}
			{:else}
				{#if !barShown}{@render primary()}{/if}
				{#if mode !== 'play'}
					<button
						type="button"
						class="ct-btn"
						disabled={busy || !card || !label}
						onclick={() =>
							card &&
							send({
								type: 'play-turn',
								holder: actingNow,
								from: card,
								action: label,
								...(target ? { target } : {}),
								mode: 'play'
							})}>Play it face up instead</button
					>
				{/if}
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					disabled={busy || !card}
					aria-pressed={collecting}
					onclick={() => (collecting = !collecting)}
					>{collecting ? 'Done adding cards' : 'Add a card to it'}</button
				>
				<button
					type="button"
					class="ct-btn"
					disabled={busy}
					onclick={() => send({ type: 'skip-turn', holder: actingNow })}>Skip this turn</button
				>
			{/if}
		</div>
		{#if collecting}
			<p class="move__how">
				Now pick the other card from your hand; pick it again to leave it out. The first card stays
				chosen.
			</p>
		{/if}
	{:else if step === 'turn' || step === 'minor'}
		<p class="move__how">Nothing for you to do just now.</p>
	{/if}

	{#if midRound && myFool && !foolHeld}
		<p class="move__buttons move__fool">
			<button type="button" class="ct-btn" disabled={busy} onclick={playTheFool}
				>Play the Fool</button
			>
			<span class="move__how">An extra turn, before anyone else's: the Fool and one more card.</span
			>
		</p>
	{/if}

	{#if midRound}
		<!-- Always here mid-round, for the GM's groups as for a player (Card Table
		     Test 3, note 9): it showed for the GM during minor actions and went,
		     because the action picker it needs only came with a turn or a minor
		     action. When neither is yours, it brings its own. -->
		<details class="move__out" bind:open={outOpen}>
			<summary>Out of turn: the Fool, or an interrupt</summary>
			<p class="move__how">
				{#if foolHeld}
					The Fool is picked up. Now pick its partner from your hand, choose the action, and play it
					out of turn.
				{:else}
					Played before the acting turn, on anybody's turn. The Fool goes with another card: pick
					the Fool, add its partner, choose the action.
				{/if}
			</p>
			{#if !picking}
				<Actions
					{catalogue}
					{faces}
					heldCard={card?.card ?? null}
					bind:chosen
					bind:custom
					asGm={isGmSeat}
					onTurn
				/>
				<label class="move__target">
					At
					<select class="ct-field" bind:value={target}>
						<option value="">nobody in particular</option>
						{#each targets as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
					</select>
				</label>
			{/if}
			<div class="move__buttons">
				{#each mine as h (h)}
					<button
						type="button"
						class="ct-btn"
						disabled={busy || !card || !label}
						onclick={() =>
							card &&
							send({
								type: 'play-out-of-turn',
								holder: h,
								from: card,
								...(extras.length > 0 ? { extra: extras } : {}),
								action: label,
								...(target ? { target } : {})
							})}>Play out of turn{h !== mySeatId ? ` for ${nameOf(h)}` : ''}</button
					>
				{/each}
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					disabled={busy || !card}
					aria-pressed={collecting}
					onclick={() => (collecting = !collecting)}
					>{collecting ? 'Done adding cards' : 'Add a card to it'}</button
				>
			</div>
		</details>
	{/if}

	{#if canShow || myReadied.length > 0 || takeBackable.length > 0}
		<div class="move__buttons move__extra">
			{#if canShow}
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					disabled={busy}
					onclick={() => send({ type: 'show-initiative', holder: mySeatId })}
					>Show my initiative</button
				>
			{/if}
			{#each myReadied as h (h)}
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					disabled={busy}
					onclick={() => send({ type: 'use-readied', holder: h })}
					>Use {forWhom(h) === 'you' ? 'my' : `${nameOf(h)}'s`} readied card</button
				>
			{/each}
			{#each takeBackable as h (h)}
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					disabled={busy}
					onclick={() => send({ type: 'take-back', holder: h })}
					>Take it back{h !== mySeatId ? ` (${nameOf(h)})` : ''}</button
				>
			{/each}
		</div>
	{/if}

	{#if barShown}
		<div class="move__bar" bind:offsetHeight={barHeight} role="group" aria-label="The picked card">
			<span class="move__bar__what"
				><strong>{cardName}</strong>{needInitiative.length > 0
					? ' — initiative'
					: label
						? ` — ${label}`
						: ' — choose an action'}{extras.length > 0 ? `, with ${extras.length} more` : ''}</span
			>
			<span class="move__buttons">{@render primary()}</span>
		</div>
		<!-- Room for the bar, so nothing at the bottom of the page is under it. -->
		<div class="move__bar-room" style:block-size="{barHeight}px" aria-hidden="true"></div>
	{/if}
</section>

<style>
	.move {
		display: grid;
		gap: 0.5rem;
	}
	.move h2 {
		margin: 0;
	}
	.move__how {
		margin: 0;
		font-size: 0.9rem;
		max-inline-size: 42rem;
	}
	.move__buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.move__acting,
	.move__target {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
	}
	.move__extras {
		margin: 0;
		font-size: 0.85rem;
		color: var(--ct-quiet);
	}
	.move__bar {
		position: fixed;
		inset-inline: 0;
		inset-block-end: 0;
		z-index: 3;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		align-items: center;
		justify-content: center;
		padding: 0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom));
		background: var(--ct-table);
		border-block-start: 1px solid var(--ct-rule-strong);
		box-shadow: 0 -2px 8px rgb(0 0 0 / 0.15);
	}
	.move__bar__what {
		font-size: 0.9rem;
	}
	.move__fool {
		align-items: center;
		margin: 0;
	}
	.move__out summary {
		cursor: pointer;
		min-block-size: 2.75rem;
		display: flex;
		align-items: center;
		font-size: 0.9rem;
	}
</style>
