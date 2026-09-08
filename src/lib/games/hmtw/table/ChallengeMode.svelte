<!--
	The Challenge, played by hand.

	Free play: the table shows you where everything is and moves what you tell it
	to. It does not run the round — guided mode does that, later and optionally —
	and it never refuses a play. The count is a number the GM advances; the
	minor-action window is a thing they open; a card goes where somebody puts it.

	Sweep and end-of-round are the two places the book is precise about *what is
	cleared*, so they are buttons rather than something you do by hand: sweeping
	takes what was played face up and leaves facedown cards, which have not
	happened yet, and ending a round discards hands and initiative while leaving
	facedown cards in play.
-->
<script lang="ts">
	import Card from './Card.svelte';
	import Hand from './Hand.svelte';
	import Pile from './Pile.svelte';
	import GmDraw from './GmDraw.svelte';
	import { suggest } from './guide';
	import Actions from './Actions.svelte';
	import { cardsForAction, type Action } from './actions';
	import type { FaceIndex } from './faces';
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import { createSelection, type Pick } from '$lib/card-table/selection';

	let {
		table,
		seats,
		faces,
		challengePack,
		mySeatId,
		waiting = [],
		canAct = false,
		busy = false,
		onCommand
	}: {
		table: ProjectedTable;
		seats: { id: string; name: string; status: string; isGm: boolean }[];
		faces: FaceIndex;
		challengePack: {
			actions: import('./actions').ActionCatalogue;
			handSizes: {
				player: { default: number };
				gm: {
					base: number;
					modifiers: { id: string; label: string; amount: number; kind: 'toggle' | 'count' }[];
					mulligan: { label: string; note: string };
				};
			};
		};
		mySeatId: string | null;
		/** Seats waiting on the GM, so they can be let in without leaving the fight. */
		waiting?: { id: string; name: string }[];
		canAct?: boolean;
		busy?: boolean;
		onCommand: (command: unknown) => void;
	} = $props();

	let selectedPick = $state<Pick | null>(null);
	const selection = createSelection(() => (selectedPick = selection.selected));

	// Seeded from the pack, then the GM's to change. The pack cannot move under a
	// live table — it is fixed for the deployment — so reading it once is right.
	// svelte-ignore state_referenced_locally
	let gmHand = $state(challengePack.handSizes.gm.base);
	// svelte-ignore state_referenced_locally
	let playerHand = $state(challengePack.handSizes.player.default);
	let newEnemy = $state('');
	let chosenAction = $state<Action | null>(null);
	let customAction = $state('');
	let declaring = $state<{ holder: string; position: 'turn' | 'minor' } | null>(null);
	let declaredAs = $state('');

	const isGm = $derived(canAct && table.gmSeat === mySeatId);

	/**
	 * What the table would do next — derived rather than stored, so it cannot
	 * drift from the round it describes. A prompt, never a gate: every control
	 * below stays exactly as available with the guide on as with it off.
	 */
	const guide = $derived(table.guided ? suggest(table, seats) : null);

	const myHand = $derived(mySeatId ? (table.zones[`seat:${mySeatId}:hand`]?.cards ?? []) : []);
	/**
	 * The other direction: with an action picked, the cards that pay for it lift
	 * in the hand. Empty when nothing is picked, so the hand is quiet by default.
	 */
	const litCards = $derived(
		chosenAction
			? cardsForAction(
					challengePack.actions,
					chosenAction,
					myHand.map((c) => faces[c]).filter(Boolean),
					{ asGm: isGm }
				)
			: []
	);
	/** Whatever the player has said this play is for — a menu pick or their own words. */
	const declaredLabel = $derived(customAction.trim() || chosenAction?.name || '');
	const admitted = $derived(seats.filter((s) => s.status === 'admitted'));
	const zone = (id: string) => table.zones[id];
	const nameOf = (id: string) => admitted.find((s) => s.id === id)?.name ?? 'Seat';

	function select(pick: Pick) {
		if (!canAct) return;
		selection.select(pick);
	}

	function drop(zoneId: string) {
		if (!canAct) return;
		const move = selection.place(zoneId);
		if (move) onCommand({ type: 'move', from: move.from, to: move.to });
	}

	function declare() {
		if (!declaring || !selectedPick) return;
		onCommand({
			type: 'place-facedown',
			holder: declaring.holder,
			from: selectedPick,
			position: declaring.position,
			label: declaredAs.trim() || declaredLabel || 'Facedown'
		});
		selection.clear();
		declaring = null;
		declaredAs = '';
	}

	function addEnemy() {
		const name = newEnemy.trim();
		if (!name) return;
		onCommand({
			type: 'add-opponent',
			id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
			name,
			count: 1
		});
		newEnemy = '';
	}
</script>

<div class="ch">
	{#if guide}
		<p class="guide">
			<span class="guide__text">{guide.text}</span>
			{#if guide.action && (!guide.gmOnly || isGm)}
				{@const action = guide.action}
				<button type="button" disabled={busy} onclick={() => onCommand(action.command)}>
					{action.label}
				</button>
			{/if}
		</p>
	{/if}

	<div class="ch__strip">
		<span class="ct-zone-label">Round {table.round.number || '—'}</span>
		<span class="ch__count">
			Initiative
			<strong>{table.round.count ?? '—'}</strong>
		</span>
		{#if isGm}
			<button
				type="button"
				class:on={table.guided}
				onclick={() => onCommand({ type: 'guided', on: !table.guided })}
			>
				{table.guided ? 'Stop guiding' : 'Guide the round'}
			</button>
			<button
				type="button"
				onclick={() => onCommand({ type: 'rewind-count' })}
				aria-label="Back one">−</button
			>
			<button type="button" onclick={() => onCommand({ type: 'advance-count' })} aria-label="On one"
				>+</button
			>
			<button
				type="button"
				class:on={table.round.minorActions}
				onclick={() => onCommand({ type: 'minor-actions', open: !table.round.minorActions })}
			>
				{table.round.minorActions ? 'Close minor actions' : 'Any minor actions?'}
			</button>
			<button type="button" onclick={() => onCommand({ type: 'sweep' })}>Sweep</button>
			<button type="button" onclick={() => onCommand({ type: 'end-round' })}>End the round</button>
		{/if}
		{#if table.round.foolDrawn}
			<span class="ch__fool">The Fool is out — both decks shuffle at the end of the round.</span>
		{/if}
	</div>

	{#if isGm}
		<div class="ch__gm">
			<GmDraw
				base={challengePack.handSizes.gm.base}
				modifiers={challengePack.handSizes.gm.modifiers}
				mulliganNote={challengePack.handSizes.gm.mulligan.note}
				bind:value={gmHand}
			/>
			<div class="ch__deal">
				<label>
					Each player draws
					<input type="number" min="0" max="20" bind:value={playerHand} />
				</label>
				<button
					type="button"
					disabled={busy}
					onclick={() => onCommand({ type: 'begin-round', playerHand, gmHand })}
				>
					Deal the round
				</button>
				<button type="button" onclick={() => onCommand({ type: 'mulligan' })}>
					{challengePack.handSizes.gm.mulligan.label}
				</button>
			</div>
			<div class="ch__enemies">
				<label>
					Add an enemy
					<input bind:value={newEnemy} placeholder="Imps" autocomplete="off" />
				</label>
				<button type="button" onclick={addEnemy}>Add</button>
			</div>
		</div>
	{/if}

	<!-- The decks, and not merely their counts.
	     Showing the numbers proved the shared-deck promise — they do not reset
	     when the mode changes — but it left the Challenge with nowhere to put a
	     card. The book asks for that on its own terms: the GM discards a card
	     for a Favour, and anyone who plays the wrong card wants it off the
	     table. Real piles here mean every card in a Challenge can go where a
	     card can go, without leaving the Challenge to do it. -->
	<div class="ch__decks">
		{#each [['player', 'Player'], ['gm', 'GM']] as [deck, who] (deck)}
			<Pile
				zone={zone(`deck:${deck}`)}
				label={`${who} deck`}
				{faces}
				selected={selectedPick}
				droppable={selectedPick !== null}
				onSelect={select}
				onDrop={drop}
			/>
			<Pile
				zone={zone(`discard:${deck}`)}
				label={`${who} discard`}
				{faces}
				selected={selectedPick}
				droppable={selectedPick !== null}
				onSelect={select}
				onDrop={drop}
			/>
		{/each}
	</div>

	{#if isGm && waiting.length > 0}
		<div class="ch__waiting">
			<span class="ct-zone-label">Waiting</span>
			{#each waiting as seat (seat.id)}
				<span class="ch__waiter">
					{seat.name}
					<form method="POST" action="?/admit">
						<input type="hidden" name="seatId" value={seat.id} />
						<button type="submit">Let in</button>
					</form>
					<form method="POST" action="?/decline">
						<input type="hidden" name="seatId" value={seat.id} />
						<button type="submit" class="quiet">Turn away</button>
					</form>
				</span>
			{/each}
		</div>
	{/if}

	<div class="ch__combatants">
		{#each admitted as seat (seat.id)}
			{@const init = zone(`seat:${seat.id}:initiative`)}
			{@const facedown = zone(`seat:${seat.id}:facedown`)}
			{@const declaredHere = table.facedown[`seat:${seat.id}:facedown`]}
			<section class="combatant" class:combatant--mine={seat.id === mySeatId}>
				<h3>
					{seat.name}{#if seat.isGm}<span class="tag">GM</span>{/if}
				</h3>

				{#if declaredHere?.position === 'turn' && facedown.count > 0}
					<Card
						face={facedown.cards?.[0] ? (faces[facedown.cards[0]] ?? null) : null}
						faceDown
						sideways
						declared={declaredHere.label}
						pick={{ zone: facedown.id }}
						onSelect={() =>
							canAct ? onCommand({ type: 'reveal-facedown', holder: seat.id }) : null}
					/>
				{/if}

				<div class="combatant__row">
					<!-- The GM plays initiative for each *enemy*, never for themselves —
					     ch.7 gives them no adventurer to act as — so their own seat has no
					     initiative slot for a card to land in by mistake. -->
					{#if !seat.isGm}
						{#if init.count > 0}
							<Card
								face={init.cards?.[0] ? (faces[init.cards[0]] ?? null) : null}
								faceDown={init.cards === undefined}
								pick={{ zone: init.id }}
								onSelect={select}
							/>
						{:else}
							<button
								type="button"
								class="slot"
								onclick={() => drop(init.id)}
								aria-label={`${seat.name}'s initiative, empty`}>Initiative</button
							>
						{/if}
					{/if}

					<div class="combatant__played" class:ct-drop={selectedPick !== null}>
						{#each zone(`seat:${seat.id}:played`).cards ?? [] as card (card)}
							<Card
								face={faces[card] ?? null}
								greaterDoom={faces[card]?.greaterDoom ?? false}
								pick={{ zone: `seat:${seat.id}:played`, card }}
								onSelect={select}
							/>
						{/each}
						{#if selectedPick}
							<!-- A real button, not a clickable div. Click-to-place is what
							     carries the keyboard story, and a drop target you cannot tab
							     to would quietly hand that back. -->
							<button
								type="button"
								class="slot slot--drop"
								onclick={() => drop(`seat:${seat.id}:played`)}>Play here</button
							>
						{/if}
					</div>
				</div>

				{#if declaredHere?.position === 'minor' && facedown.count > 0}
					<Card
						face={facedown.cards?.[0] ? (faces[facedown.cards[0]] ?? null) : null}
						faceDown
						sideways
						declared={declaredHere.label}
						pick={{ zone: facedown.id }}
						onSelect={() =>
							canAct ? onCommand({ type: 'reveal-facedown', holder: seat.id }) : null}
					/>
				{/if}

				{#if seat.id === mySeatId && selectedPick && facedown.count === 0}
					<div class="declare">
						<button
							type="button"
							onclick={() => (declaring = { holder: seat.id, position: 'turn' })}
						>
							Play facedown — your turn
						</button>
						<button
							type="button"
							onclick={() => (declaring = { holder: seat.id, position: 'minor' })}
						>
							Play facedown — minor action
						</button>
						<p class="declare__note">
							A defensive card stays in front of you even when it is for somebody else — ch.7 lets
							you Riposte or Dodge for anyone in your zone. Say who in the label.
						</p>
					</div>
				{/if}
			</section>
		{/each}

		{#each table.opponents as enemy (enemy.id)}
			{@const init = zone(`opponent:${enemy.id}:initiative`)}
			<section class="combatant combatant--enemy">
				<h3>
					{enemy.name}
					{#if enemy.count > 1}<span class="tag">×{enemy.count}</span>{/if}
					{#if isGm}
						<button
							type="button"
							class="tag-btn"
							onclick={() => onCommand({ type: 'remove-opponent', id: enemy.id })}>remove</button
						>
					{/if}
				</h3>
				<div class="combatant__row">
					{#if init.count > 0}
						<Card
							face={init.cards?.[0] ? (faces[init.cards[0]] ?? null) : null}
							faceDown={init.cards === undefined}
							pick={{ zone: init.id }}
							onSelect={select}
						/>
					{:else}
						<button type="button" class="slot" onclick={() => drop(init.id)}>Initiative</button>
					{/if}
					<div class="combatant__played" class:ct-drop={selectedPick !== null}>
						{#each zone(`opponent:${enemy.id}:played`).cards ?? [] as card (card)}
							<Card
								face={faces[card] ?? null}
								greaterDoom={faces[card]?.greaterDoom ?? false}
								pick={{ zone: `opponent:${enemy.id}:played`, card }}
								onSelect={select}
							/>
						{/each}
						{#if selectedPick}
							<button
								type="button"
								class="slot slot--drop"
								onclick={() => drop(`opponent:${enemy.id}:played`)}>Play here</button
							>
						{/if}
					</div>
				</div>
			</section>
		{/each}
	</div>

	{#if mySeatId}
		<div class="ch__hand">
			<div>
				<p class="ct-zone-label">{nameOf(mySeatId)} — your hand</p>
				<Hand
					zone={zone(`seat:${mySeatId}:hand`)}
					{faces}
					grouped={table.gmSeat === mySeatId}
					selected={selectedPick}
					lit={litCards}
					onSelect={select}
					onDrop={drop}
				/>
			</div>
			<Actions
				catalogue={challengePack.actions}
				{faces}
				heldCard={selectedPick?.zone === `seat:${mySeatId}:hand`
					? (selectedPick.card ?? null)
					: null}
				bind:chosen={chosenAction}
				bind:custom={customAction}
				asGm={isGm}
			/>
		</div>
	{/if}
</div>

{#if declaring}
	<div class="declare__ask">
		<label>
			What is it for?
			<input bind:value={declaredAs} placeholder="Riposte" autocomplete="off" />
		</label>
		<p class="declare__hint">Everyone sees this. Only you see the card.</p>
		<button type="button" onclick={declare}>Lay it down</button>
		<button type="button" class="quiet" onclick={() => (declaring = null)}>Never mind</button>
	</div>
{/if}

<style>
	.ch {
		padding: 1.25rem;
		display: grid;
		gap: 1.25rem;
	}
	/*
	 * Quiet. The guide is a voice at the table rather than an instruction from
	 * the software: it says what is happening and offers the obvious next thing,
	 * and everything it suggests is also reachable by hand a few inches below.
	 */
	.guide {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
		margin: 0;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 4px;
	}
	.guide__text {
		font-family: 'IM Fell English', Georgia, serif;
	}
	.ch__strip {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
		border-block-end: 1px solid var(--ct-rule);
		padding-block-end: 0.75rem;
	}
	.ch__count strong {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-size: 1.3rem;
		color: var(--ct-mark);
		margin-inline-start: 0.35rem;
	}
	.ch__fool {
		color: var(--ct-mark);
		font-size: 0.85rem;
	}
	.ch__gm {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.ch__deal,
	.ch__enemies {
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}
	.ch__decks {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.ch__waiting,
	.ch__waiter {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	/*
	 * A grid with fixed tracks, not a wrapping flex row.
	 *
	 * The combatants reflowed whenever a drop target or a declare button
	 * appeared, so names slid between rows under the cursor — and an initiative
	 * card went onto the wrong seat because of it. Fixed columns mean the layout
	 * cannot move while somebody is aiming at it.
	 */
	.ch__combatants {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
		gap: 1.5rem;
		align-items: start;
	}
	.combatant {
		border-block-start: 1px solid var(--ct-rule);
		padding-block-start: 0.5rem;
		/* Room for the controls that come and go, so their arrival moves nothing. */
		min-block-size: calc(var(--ct-card-h) + 6rem);
	}
	.combatant--mine {
		border-block-start-color: var(--ct-rule-strong);
	}
	.combatant--enemy h3 {
		color: var(--ct-quiet);
	}
	.combatant h3 {
		font-family: 'IM Fell English', Georgia, serif;
		font-weight: 400;
		font-size: 1rem;
		margin: 0 0 0.5rem;
		display: flex;
		gap: 0.4rem;
		align-items: baseline;
	}
	.combatant__row {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}
	.combatant__played {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
		min-inline-size: var(--ct-card-w);
		min-block-size: var(--ct-card-h);
		border-radius: 4px;
	}
	.slot--drop {
		border-style: solid;
		border-color: var(--ct-rule-strong);
		color: var(--ct-mark);
	}
	.slot {
		inline-size: var(--ct-card-w);
		block-size: var(--ct-card-h);
		border: 1px dashed var(--ct-rule);
		border-radius: var(--ct-radius);
		background: none;
		color: var(--ct-quiet);
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-size: 0.7rem;
		cursor: pointer;
	}
	.tag {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-size: 0.7rem;
		color: var(--ct-quiet);
	}
	.tag-btn {
		background: none;
		border: 0;
		font: inherit;
		font-size: 0.7rem;
		color: var(--ct-quiet);
		text-decoration: underline;
		cursor: pointer;
	}
	.declare {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-block-start: 0.5rem;
	}
	.declare__note {
		flex-basis: 100%;
		margin: 0.25rem 0 0;
		font-size: 0.78rem;
		color: var(--ct-quiet);
	}
	.declare__ask {
		position: fixed;
		inset-block-end: 1rem;
		inset-inline-start: 50%;
		transform: translateX(-50%);
		background: var(--ct-table-low);
		border: 1px solid var(--ct-rule-strong);
		border-radius: 4px;
		padding: 1rem;
		display: grid;
		gap: 0.5rem;
		z-index: 10;
	}
	.declare__hint {
		margin: 0;
		font-size: 0.8rem;
		color: var(--ct-quiet);
	}
	button,
	input {
		font: inherit;
	}
	button {
		background: none;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: inherit;
		padding: 0.3rem 0.7rem;
		min-block-size: 2.75rem;
		cursor: pointer;
	}
	button.on {
		border-color: var(--ct-mark);
		color: var(--ct-mark);
	}
	button.quiet {
		border-color: transparent;
		color: var(--ct-quiet);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	input {
		background: transparent;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: inherit;
		padding: 0.35rem 0.5rem;
		min-block-size: 2.75rem;
	}
	label {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.9rem;
	}
	.ch__hand {
		border-block-start: 1px solid var(--ct-rule-strong);
		padding-block-start: 0.75rem;
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.tag-btn,
	.declare button {
		min-block-size: auto;
	}
</style>
