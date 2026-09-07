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
	import GmDraw from './GmDraw.svelte';
	import type { FaceIndex } from './faces';
	import type { ProjectedTable } from '$lib/card-table/client-types';
	import { createSelection, type Pick } from '$lib/card-table/selection';

	let {
		table,
		seats,
		faces,
		challengePack,
		mySeatId,
		canAct = false,
		busy = false,
		onCommand
	}: {
		table: ProjectedTable;
		seats: { id: string; name: string; status: string; isGm: boolean }[];
		faces: FaceIndex;
		challengePack: {
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
	let declaring = $state<{ holder: string; position: 'turn' | 'minor' } | null>(null);
	let declaredAs = $state('');

	const isGm = $derived(canAct && table.gmSeat === mySeatId);
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
			label: declaredAs.trim() || 'Facedown'
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
	<div class="ch__strip">
		<span class="ct-zone-label">Round {table.round.number || '—'}</span>
		<span class="ch__count">
			Initiative
			<strong>{table.round.count ?? '—'}</strong>
		</span>
		{#if isGm}
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

					<div
						class="combatant__played ct-drop"
						role="presentation"
						onclick={() => drop(`seat:${seat.id}:played`)}
					>
						{#each zone(`seat:${seat.id}:played`).cards ?? [] as card (card)}
							<Card
								face={faces[card] ?? null}
								greaterDoom={faces[card]?.greaterDoom ?? false}
								pick={{ zone: `seat:${seat.id}:played`, card }}
								onSelect={select}
							/>
						{/each}
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
							Lay it down for your turn
						</button>
						<button
							type="button"
							onclick={() => (declaring = { holder: seat.id, position: 'minor' })}
						>
							…as a minor action
						</button>
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
					<div
						class="combatant__played ct-drop"
						role="presentation"
						onclick={() => drop(`opponent:${enemy.id}:played`)}
					>
						{#each zone(`opponent:${enemy.id}:played`).cards ?? [] as card (card)}
							<Card
								face={faces[card] ?? null}
								greaterDoom={faces[card]?.greaterDoom ?? false}
								pick={{ zone: `opponent:${enemy.id}:played`, card }}
								onSelect={select}
							/>
						{/each}
					</div>
				</div>
			</section>
		{/each}
	</div>

	{#if mySeatId}
		<div class="ch__hand">
			<p class="ct-zone-label">{nameOf(mySeatId)} — your hand</p>
			<Hand
				zone={zone(`seat:${mySeatId}:hand`)}
				{faces}
				grouped={table.gmSeat === mySeatId}
				selected={selectedPick}
				onSelect={select}
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
		color: var(--ct-light);
		margin-inline-start: 0.35rem;
	}
	.ch__fool {
		color: var(--ct-light);
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
	.ch__combatants {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.combatant {
		border-block-start: 1px solid var(--ct-rule);
		padding-block-start: 0.5rem;
		min-inline-size: 12rem;
	}
	.combatant--mine {
		border-block-start-color: var(--ct-light-soft);
	}
	.combatant--enemy h3 {
		color: rgb(236 231 219 / 80%);
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
	.slot {
		inline-size: var(--ct-card-w);
		block-size: var(--ct-card-h);
		border: 1px dashed var(--ct-rule);
		border-radius: var(--ct-radius);
		background: none;
		color: rgb(236 231 219 / 40%);
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-size: 0.7rem;
		cursor: pointer;
	}
	.tag {
		font-family: 'IM Fell Great Primer SC', Georgia, serif;
		font-size: 0.7rem;
		color: rgb(236 231 219 / 55%);
	}
	.tag-btn {
		background: none;
		border: 0;
		font: inherit;
		font-size: 0.7rem;
		color: rgb(236 231 219 / 45%);
		text-decoration: underline;
		cursor: pointer;
	}
	.declare {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-block-start: 0.5rem;
	}
	.declare__ask {
		position: fixed;
		inset-block-end: 1rem;
		inset-inline-start: 50%;
		transform: translateX(-50%);
		background: var(--ct-table-low);
		border: 1px solid var(--ct-light-soft);
		border-radius: 4px;
		padding: 1rem;
		display: grid;
		gap: 0.5rem;
		z-index: 10;
	}
	.declare__hint {
		margin: 0;
		font-size: 0.8rem;
		color: rgb(236 231 219 / 55%);
	}
	button,
	input {
		font: inherit;
	}
	button {
		background: none;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: var(--ct-card);
		padding: 0.3rem 0.7rem;
		min-block-size: 2.4rem;
		cursor: pointer;
	}
	button.on {
		border-color: var(--ct-light);
		color: var(--ct-light);
	}
	button.quiet {
		border-color: transparent;
		color: rgb(236 231 219 / 55%);
	}
	button:disabled {
		opacity: 0.4;
		cursor: default;
	}
	input {
		background: rgb(0 0 0 / 25%);
		border: 1px solid var(--ct-rule-strong);
		border-radius: 3px;
		color: var(--ct-card);
		padding: 0.35rem 0.5rem;
		min-block-size: 2.4rem;
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
	}
	.tag-btn,
	.declare button {
		min-block-size: auto;
	}
</style>
