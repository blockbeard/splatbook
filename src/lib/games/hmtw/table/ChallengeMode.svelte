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
	import SeatName from './SeatName.svelte';
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
	/**
	 * Whether the deal panel is open — **local to this GM's browser**, never a
	 * table command. It is one person's view of their own controls, and putting
	 * it in the shared blob would open a panel on every screen at the table.
	 */
	// svelte-ignore state_referenced_locally
	let dealOpen = $state(table.round.number === 0);
	// svelte-ignore state_referenced_locally
	let lastRound = table.round.number;
	let chosenAction = $state<Action | null>(null);
	let customAction = $state('');
	let declaring = $state<{ holder: string; position: 'turn' | 'minor' } | null>(null);
	let declaredAs = $state('');

	const isGm = $derived(canAct && table.gmSeat === mySeatId);

	/**
	 * The panel opens by itself on a table that has never dealt, and closes when
	 * a round arrives. Round zero and nothing else: an earlier draft opened it
	 * whenever the GM's hand was empty, which springs a panel over the table the
	 * moment they play their last card mid-round.
	 *
	 * Between those two moments it is the GM's to open, and stays where they put
	 * it — this only reacts to the round *changing*.
	 */
	$effect(() => {
		const round = table.round.number;
		if (round === lastRound) return;
		lastRound = round;
		dealOpen = round === 0;
	});

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

	<!--
		The round, and what is being done to it.

		The state leads, because "Round 3, Initiative 7" is the only question
		anybody asks mid-fight — it is how a player knows their turn has come —
		and it used to be set in the smallest type on the page while six
		equal-weight buttons shouted over it. The stepper sits *inside* the count
		it moves, rather than floating among wordy buttons that have nothing to do
		with it; everything else is round bookkeeping and reads as such.
	-->
	<div class="ch__strip">
		<p class="ch__state">
			<span class="ch__state__round">Round {table.round.number || '—'}</span>
			<span class="ch__state__count">
				Initiative
				<strong>{table.round.count ?? '—'}</strong>
				{#if isGm}
					<span class="ch__stepper">
						<button
							type="button"
							class="ct-btn"
							onclick={() => onCommand({ type: 'rewind-count' })}
							aria-label="Back one">−</button
						>
						<button
							type="button"
							class="ct-btn"
							onclick={() => onCommand({ type: 'advance-count' })}
							aria-label="On one">+</button
						>
					</span>
				{/if}
			</span>
		</p>
		{#if isGm}
			<div class="ch__round-controls">
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					class:ct-btn--on={table.guided}
					onclick={() => onCommand({ type: 'guided', on: !table.guided })}
				>
					{table.guided ? 'Stop guiding' : 'Guide the round'}
				</button>
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					class:ct-btn--on={table.round.minorActions}
					onclick={() => onCommand({ type: 'minor-actions', open: !table.round.minorActions })}
				>
					{table.round.minorActions ? 'Close minor actions' : 'Any minor actions?'}
				</button>
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					onclick={() => onCommand({ type: 'sweep' })}>Sweep</button
				>
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					onclick={() => onCommand({ type: 'end-round' })}>End the round</button
				>
			</div>
		{/if}
		{#if table.round.foolDrawn}
			<span class="ch__fool">The Fool is out — both decks shuffle at the end of the round.</span>
		{/if}
	</div>

	{#if isGm}
		<!--
			Dealing is a once-a-round decision that was taking the permanent first
			screen: on a phone the GM scrolled some 1,700px of checklist and fields
			before one card was visible, every round, forever. A native <details>
			rather than a hand-rolled panel, so the keyboard and the expanded/
			collapsed announcement come with it.
		-->
		<details class="ch__deal" bind:open={dealOpen}>
			<summary>Deal the round…</summary>
			<div class="ch__deal__body">
				<GmDraw
					base={challengePack.handSizes.gm.base}
					modifiers={challengePack.handSizes.gm.modifiers}
					bind:value={gmHand}
				/>
				<div class="ch__deal__go">
					<label>
						Each player draws
						<input
							type="number"
							min="0"
							max="20"
							class="ct-field ct-field--number"
							bind:value={playerHand}
						/>
					</label>
					<!-- The one action this panel exists for, so it is the one filled
					     button on it — which is also what tells it apart from the summary
					     above, which says nearly the same words and opens rather than
					     acts. -->
					<button
						type="button"
						class="ct-btn ct-btn--primary"
						disabled={busy}
						onclick={() => onCommand({ type: 'begin-round', playerHand, gmHand })}
					>
						Deal the round
					</button>
				</div>
			</div>
		</details>
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
						<button type="submit" class="ct-btn ct-btn--primary">Let in</button>
					</form>
					<form method="POST" action="?/decline">
						<input type="hidden" name="seatId" value={seat.id} />
						<button type="submit" class="ct-btn ct-btn--quiet">Turn away</button>
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
			{@const durable = zone(`seat:${seat.id}:durable`)}
			{@const inspiration = durable?.cards?.[0]}
			<section class="combatant" class:combatant--mine={seat.id === mySeatId}>
				<h3>
					<SeatName
						name={seat.name}
						isGm={seat.isGm}
						mine={seat.id === mySeatId}
						hand={zone(`seat:${seat.id}:hand`)?.count ?? 0}
					/>
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

					<!--
						Inspiration, in the fight where it gets spent.

						Ch.5's cards are held publicly and they survive both the Sweep and
						the end of a Challenge on purpose — so the one place they were
						invisible was the one place you would reach for one. Shown when a
						seat holds one, and offered as a slot when somebody is carrying a
						card, so it does not put an empty frame in front of every
						combatant for the whole fight.
					-->
					{#if inspiration}
						<Card
							face={faces[inspiration] ?? null}
							pick={{ zone: durable.id, card: inspiration }}
							selected={selectedPick?.zone === durable.id}
							onSelect={(p) => (selectedPick ? drop(durable.id) : select(p))}
						/>
					{:else if selectedPick && durable}
						<button
							type="button"
							class="slot slot--drop"
							onclick={() => drop(durable.id)}
							aria-label={`Give ${seat.name} an inspiration card`}>Inspiration</button
						>
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

		{#if isGm}
			<!-- With the combatants, not with the deal: an enemy arriving is a thing
			     that happens to this row, and it read as a pair with "Deal the round"
			     only because the two were put side by side. -->
			<section class="combatant combatant--add">
				<h3>Add an enemy</h3>
				<form class="add-enemy" onsubmit={(e) => (e.preventDefault(), addEnemy())}>
					<label class="sr-only" for="new-enemy">Enemy name</label>
					<input
						id="new-enemy"
						class="ct-field"
						bind:value={newEnemy}
						placeholder="Imps"
						autocomplete="off"
					/>
					<button type="submit" class="ct-btn" disabled={busy || newEnemy.trim() === ''}>Add</button
					>
				</form>
			</section>
		{/if}
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
			{#if mySeatId && selectedPick && (table.zones[`seat:${mySeatId}:facedown`]?.count ?? 0) === 0}
				<!--
					Moved here from inside your own combatant.

					It only ever appeared on your seat — a facedown card goes in front of
					its holder, and you are the only holder you can be — so it was never
					really about the seat it sat in. Where it *did* have an effect was on
					the layout: every combatant had to reserve room for a block that only
					one of them could ever show, which is where the empty track under the
					fight came from. Down here it grows the hand, which is below
					everything and moves nothing.
				-->
				<div class="declare">
					<button
						type="button"
						class="ct-btn"
						onclick={() => (declaring = { holder: mySeatId, position: 'turn' })}
					>
						Play facedown — your turn
					</button>
					<button
						type="button"
						class="ct-btn"
						onclick={() => (declaring = { holder: mySeatId, position: 'minor' })}
					>
						Play facedown — minor action
					</button>
					<p class="declare__note">
						A defensive card stays in front of you even when it is for somebody else — ch.7 lets you
						Riposte or Dodge for anyone in your zone. Say who in the label.
					</p>
				</div>
			{/if}
			{#if isGm}
				<!--
					Judged holding the hand — "discard and draw again when it is mostly
					greater dooms" — so it belongs here, beside the doom grouping that
					answers the question, and not in the deal panel, which has closed by
					the time anyone can decide this.
				-->
				<p class="ch__mulligan">
					<button
						type="button"
						class="ct-btn"
						disabled={busy}
						onclick={() => onCommand({ type: 'mulligan' })}
					>
						{challengePack.handSizes.gm.mulligan.label}
					</button>
					<span>{challengePack.handSizes.gm.mulligan.note}</span>
				</p>
			{/if}
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
			<input class="ct-field" bind:value={declaredAs} placeholder="Riposte" autocomplete="off" />
		</label>
		<p class="declare__hint">Everyone sees this. Only you see the card.</p>
		<button type="button" class="ct-btn ct-btn--primary" onclick={declare}>Lay it down</button>
		<button type="button" class="ct-btn ct-btn--quiet" onclick={() => (declaring = null)}
			>Never mind</button
		>
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
		gap: 0.75rem 1.25rem;
		align-items: center;
		flex-wrap: wrap;
		border-block-end: 1px solid var(--ct-rule);
		padding-block-end: 0.75rem;
	}
	/* The state, at the top of the scale. */
	.ch__state {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: 1rem;
		flex-wrap: wrap;
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-size: var(--ct-step-loud);
		color: var(--ct-mark);
		line-height: 1.1;
	}
	.ch__state__round {
		color: var(--ct-quiet);
	}
	.ch__state__count {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		/* At 320px the word, the number and the stepper together are wider than
		   the gutter allows, and a flex item's default `min-width: auto` lets
		   them push past it rather than wrap. Wrapping drops the stepper under
		   the number it moves, which keeps them together — the point of putting
		   them in one element. */
		flex-wrap: wrap;
		min-inline-size: 0;
	}
	.ch__state__count strong {
		font-weight: 400;
		/* The number is the answer; the word in front of it is the question. */
		min-inline-size: 1.2em;
		display: inline-block;
	}
	/* Bound to the number it moves, rather than loose among wordy buttons. */
	.ch__stepper {
		display: flex;
		gap: 0.25rem;
		align-self: center;
	}
	.ch__stepper button {
		min-inline-size: 2.75rem;
		padding-inline: 0;
	}
	/* Round bookkeeping: once a round each, and sized accordingly. */
	/*
	 * Beside the state, not flush right.
	 *
	 * Pushing these to the far edge put "End the round" 23px directly below
	 * "Reset the table", both right-aligned to the same pixel and both
	 * work-destroying — a misclick between the two costs a fight or a table.
	 * The hierarchy here is type and colour; the alignment was doing nothing for
	 * it and quite a lot against it.
	 */
	.ch__round-controls {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.ch__fool {
		color: var(--ct-mark);
		font-size: 0.85rem;
	}
	/* The deal panel. Closed it is one line; open it is what it always was. */
	.ch__deal > summary {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		cursor: pointer;
		inline-size: fit-content;
		padding: 0.5rem 0.9rem;
		min-block-size: 2.75rem;
		display: flex;
		align-items: center;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: var(--ct-mark);
	}
	.ch__deal[open] > summary {
		margin-block-end: 0.75rem;
	}
	.ch__deal__body {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}
	.ch__deal__go {
		display: grid;
		gap: 0.5rem;
		align-content: start;
	}
	.ch__mulligan {
		margin: 0.75rem 0 0;
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
		flex-wrap: wrap;
		max-inline-size: 30rem;
	}
	.ch__mulligan span {
		color: var(--ct-quiet);
		font-size: 0.8rem;
	}
	.add-enemy {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
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
		/*
		 * A heading and one row of cards, and no more.
		 *
		 * This used to reserve six rem above a card's height, for controls that
		 * came and went — and the tallest of those, the two "Play facedown"
		 * buttons and their note, could only ever appear on *one* combatant.
		 * Every other seat and every enemy reserved room for a block they could
		 * not show, which is where the empty band under the fight came from: 236
		 * reserved against 174 used.
		 *
		 * With that block moved down to the hand, nothing that appears on
		 * *selection* changes a combatant's height any more — the drop slot and
		 * the inspiration slot are card-sized and sit inside a row that already
		 * reserves a card's height. Checked rather than assumed: with the
		 * reservation removed entirely, picking a card up moved no combatant by a
		 * pixel. What is left is a floor, so a fight keeps a regular rhythm
		 * instead of ragged boxes.
		 */
		min-block-size: calc(var(--ct-card-h) + 3rem);
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
	/* Not one of the three tiers: it is a word inside a heading, and giving it
	   the tiers' 44px floor would inflate the row it sits in. An underline is
	   what identifies it. */
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
	/* Buttons take their look from `.ct-btn` in table.css; what is left here is
	   layout. */
	/* Fields take their look and their width from `.ct-field` in table.css. */
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
