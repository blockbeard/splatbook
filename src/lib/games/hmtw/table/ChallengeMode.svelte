<!--
	The Challenge, one step at a time (phase 32).

	It used to be played by hand: a count the GM stepped, a minor-action window
	they opened and shut, a Sweep, and any card movable by anyone. The first
	live test (25 November 2026) found that nobody could tell what was going on.
	Now the round walks ch.7's steps — initiative, the count, the turn, minor
	actions, resolve — and "Your move" offers each person exactly what the step
	allows. Played cards go into the open, labelled with who and what for. The
	GM can move the round on at any point, and the table still never judges a
	value, a suit or a target.

	End of round is a button because the book is precise about what it clears:
	hands and initiative go, facedown (readied) cards stay in play.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from './Card.svelte';
	import Hand from './Hand.svelte';
	import SeatName from './SeatName.svelte';
	import Pile from './Pile.svelte';
	import PileViewer from './PileViewer.svelte';
	import FatePile from './FatePile.svelte';
	import GmDraw from './GmDraw.svelte';
	import { gmDrawFacts } from './draw';
	import { mayReach } from '../engine/zones';
	import Scene from './Scene.svelte';
	import ZonePicker from './ZonePicker.svelte';
	import Creatures from './Creatures.svelte';
	import { suggest } from './guide';
	import { HOLD_MS, actionKey, shouldHold } from './hold';
	import YourMove from './YourMove.svelte';
	import { addsWords, readiedAdds } from './adds';
	import PlayArea from './PlayArea.svelte';
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
		onCommand,
		token = '',
		onPicture
	}: {
		table: ProjectedTable;
		seats: { id: string; name: string; status: string; isGm: boolean }[];
		faces: FaceIndex;
		challengePack: {
			actions: import('./actions').ActionCatalogue;
			endOfRound: import('./guide').GuideWords['endOfRound'];
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
		/** The room token, for fetching the scene's picture. */
		token?: string;
		/** Put up the scene's picture; resolves to why not, or null. */
		onPicture?: (dataUrl: string) => Promise<string | null>;
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
	let newEnemyCount = $state(1);
	/** Blank means "not tracking HD" — a number the GM did not type is not a zero. */
	let newEnemyHealth = $state<number | null>(null);
	let newEnemyDefense = $state<number | null>(null);
	/**
	 * Whether the deal panel is open — **local to this GM's browser**, never a
	 * table command. It is one person's view of their own controls, and putting
	 * it in the shared blob would open a panel on every screen at the table.
	 */
	// svelte-ignore state_referenced_locally
	let dealOpen = $state(table.round.step === 'deal');
	// svelte-ignore state_referenced_locally
	let lastRound = table.round.number;
	let chosenAction = $state<Action | null>(null);
	let customAction = $state('');
	/** Cards added to the one picked up, for a play of more than one card. */
	let extras = $state<Pick[]>([]);
	let collecting = $state(false);

	const isGm = $derived(canAct && table.gmSeat === mySeatId);
	/**
	 * Whether this seat runs the table: the GM, or anyone while nobody holds the
	 * GM seat — the same question the server asks.
	 */
	const runs = $derived(canAct && (!table.gmSeat || table.gmSeat === mySeatId));
	/** Ask what the server will, so nothing is offered that it would refuse. */
	const canPut = (zoneId: string) =>
		canAct && mySeatId !== null && mayReach(zoneId, mySeatId, runs, 'put');
	const canTake = (zoneId: string) =>
		canAct && mySeatId !== null && mayReach(zoneId, mySeatId, runs, 'take');

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
		dealOpen = table.round.step === 'deal';
	});

	/**
	 * What the table would do next, said to whoever is looking — derived from
	 * the round's step, so it cannot drift from the round it describes. The
	 * steps are the guide now; there is no switching it off.
	 */
	const guide = $derived(suggest(table, seats, challengePack));

	// A moment's grace when the guide's button changes what it does, so a press
	// aimed at the old one can't land on the new (`hold.ts`, phase 33).
	let held = $state(false);
	let heldTimer: ReturnType<typeof setTimeout> | undefined;
	let lastAction: string | null = null;
	$effect(() => {
		const key = actionKey(table.round.step, table.round.count, guide.action?.label);
		if (shouldHold(lastAction, key)) {
			held = true;
			clearTimeout(heldTimer);
			heldTimer = setTimeout(() => (held = false), HOLD_MS);
		}
		lastAction = key;
	});
	$effect(() => () => clearTimeout(heldTimer));

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
					{ asGm: isGm, minor: table.round.step === 'minor' }
				)
			: []
	);
	const admitted = $derived(seats.filter((s) => s.status === 'admitted'));
	const zone = (id: string) => table.zones[id];
	/** The lines of the GM's draw the table can fill in itself. */
	const drawFacts = $derived(
		gmDrawFacts(table.opponents, admitted.filter((s) => !s.isGm && s.id !== table.gmSeat).length)
	);
	const nameOf = (id: string) => admitted.find((s) => s.id === id)?.name ?? 'Seat';

	function select(pick: Pick) {
		if (!canTake(pick.zone)) return;
		// Adding cards to a play: a pick from your hand joins it, or leaves it.
		if (collecting && selectedPick && pick.zone === selectedPick.zone && pick.card) {
			if (pick.card === selectedPick.card) return;
			extras = extras.some((e) => e.card === pick.card)
				? extras.filter((e) => e.card !== pick.card)
				: [...extras, pick];
			return;
		}
		selection.select(pick);
	}

	function drop(zoneId: string) {
		if (!canPut(zoneId)) return;
		const move = selection.place(zoneId);
		if (move) onCommand({ type: 'move', from: move.from, to: move.to });
	}

	/*
	 * A discard opened to look through, as Decks mode has always allowed. The
	 * first live test found the Challenge's could not be opened at all.
	 */
	let openPile = $state<string | null>(null);
	let zoomed = $state<string | null>(null);
	let openedFrom: HTMLElement | null = null;

	function openPileFrom(id: string) {
		openedFrom = document.activeElement as HTMLElement | null;
		openPile = id;
	}

	function closePane() {
		openPile = null;
		openedFrom?.focus();
		openedFrom = null;
	}

	function onKey(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (zoomed) zoomed = null;
		else if (openPile) closePane();
	}

	function addEnemy() {
		const name = newEnemy.trim();
		if (!name) return;
		const hd = (n: number | null) =>
			typeof n === 'number' && Number.isFinite(n)
				? Math.max(0, Math.min(99, Math.floor(n)))
				: undefined;
		onCommand({
			type: 'add-opponent',
			id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
			name,
			count: Math.max(1, Math.min(52, Math.floor(newEnemyCount || 1))),
			health: hd(newEnemyHealth),
			defense: hd(newEnemyDefense)
		});
		newEnemy = '';
		newEnemyCount = 1;
		newEnemyHealth = null;
		newEnemyDefense = null;
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="ch">
	{#if guide || (isGm && waiting.length > 0)}
		<div class="guide">
			{#if isGm}
				<!-- A seat request in the line that stays on screen (Card Table Test 3,
				     note 1): on a window a third of an ultrawide, the list further
				     down was below the bottom of the screen, and nobody saw it. -->
				{#each waiting as seat (seat.id)}
					<span class="guide__ask">
						<span>{seat.name} is asking for a seat</span>
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
			{/if}
			{#if guide}
				<span class="guide__text">{guide.text}</span>
			{/if}
			{#if guide?.action && (!guide.gmOnly || runs)}
				{@const action = guide.action}
				<!-- The filled button: the one thing the round is waiting for. "Next"
				     was a quiet button among the text, and the GM went looking for it in
				     the second live test. An override (skipping somebody, starting the
				     count early) is quiet, so it is never taken for Next (Session 14). -->
				<button
					type="button"
					class="ct-btn"
					class:ct-btn--primary={!guide.quiet}
					disabled={busy || held}
					onclick={() => onCommand(action.command)}
				>
					{action.label}
				</button>
			{/if}
			{#if mySeatId && zone(`seat:${mySeatId}:hand`)}
				<a class="guide__jump" href="#move-heading">Your move</a>
			{/if}
			{#if guide?.rule}
				<!-- A new tab, so the table keeps its place mid-fight. -->
				<a
					class="guide__rule"
					href={resolve('/[game=game]/reference/[section]', {
						game: 'hmtw',
						section: guide.rule.page
					})}
					target="_blank"
					rel="noopener">{guide.rule.label}<span class="sr-only"> (opens in a new tab)</span></a
				>
			{/if}
		</div>
	{/if}

	<!--
		The round, and what is being done to it.

		The state leads, because "Round 3, Initiative 7" is the only question
		anybody asks mid-fight — it is how a player knows their turn has come —
		and it used to be set in the smallest type on the page while six
		equal-weight buttons shouted over it. The count moves itself now (phase
		32); what the GM steps instead is the round, through the guide line.
	-->
	<div class="ch__strip">
		<p class="ch__state">
			<span class="ch__state__round">Round {table.round.number || '—'}</span>
			<span class="ch__state__count">
				Initiative
				<strong>{table.round.count ?? '—'}</strong>
			</span>
		</p>
		{#if isGm}
			<div class="ch__round-controls">
				<button
					type="button"
					class="ct-btn ct-btn--quiet"
					disabled={table.round.step === 'deal'}
					onclick={() => {
						if (
							table.round.step === 'over' ||
							confirm('End the round now? Everyone still to act loses their turn.')
						)
							onCommand({ type: 'end-round' });
					}}>End the round</button
				>
			</div>
		{/if}
		{#if table.round.foolDrawn}
			<span class="ch__fool">The Fool is out — both decks shuffle at the end of the round.</span>
		{/if}
	</div>

	<PlayArea {table} {seats} {faces} {runs} {busy} {onCommand} />

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
					facts={drawFacts}
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

	<Scene {table} {seats} {isGm} {busy} {onCommand} {token} {onPicture} />

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
				onOpen={(id) => openPileFrom(id)}
			/>
		{/each}
		{#if canAct}
			<!-- A Test of Fate, in a fight as out of one (phase 33): Session 14 had
			     no way to take one in a Challenge. The top of the player deck, onto
			     the turned-over pile below, where anyone can see what it came to. -->
			<button
				type="button"
				class="ct-btn ch__fate-btn"
				disabled={busy}
				onclick={() => onCommand({ type: 'move', from: { zone: 'deck:player' }, to: 'fate' })}
			>
				Test of Fate
			</button>
		{/if}
	</div>

	{#if zone('fate')?.count > 0}
		<FatePile
			zone={zone('fate')}
			{faces}
			selected={selectedPick}
			locked={busy || !canAct}
			onSelect={select}
			onClear={() => onCommand({ type: 'clear-fate' })}
		/>
	{/if}

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

	<!-- Decks mode heads its rail with "At the table"; the Challenge had nothing,
	     so its combatant headings were h3s under an h1 with the level between them
	     missing. Somebody navigating this page by heading was being told the
	     combatants belong to a section that does not exist. -->
	<h2 class="ct-zone-label">In the fight</h2>
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
				{#if !seat.isGm}
					<ZonePicker
						who={seat.id}
						label={seat.name}
						zones={table.scene.zones}
						at={table.scene.at[seat.id]}
						disabled={!canAct || busy || (seat.id !== mySeatId && !runs)}
						{onCommand}
					/>
				{/if}

				{#if declaredHere?.position === 'turn' && facedown.count > 0}
					<Card
						face={facedown.cards?.[0] ? (faces[facedown.cards[0]] ?? null) : null}
						faceDown
						sideways
						declared={`${declaredHere.label} · ${addsWords(readiedAdds(declaredHere.position))}`}
						pick={{ zone: facedown.id }}
						onSelect={() =>
							canAct && (seat.id === mySeatId || runs)
								? onCommand({ type: 'use-readied', holder: seat.id })
								: null}
					/>
				{/if}

				<div class="combatant__row">
					<!-- The GM plays initiative for each *enemy*, never for themselves —
					     ch.7 gives them no adventurer to act as — so their own seat has no
					     initiative slot for a card to land in by mistake. -->
					{#if !seat.isGm}
						<!-- Face down until its number comes up, it is named as a target, or
						     its holder shows it (phase 32): played through "Your move", never
						     dropped here, so a card meant for initiative cannot land in play. -->
						{#if init.count > 0}
							<Card
								face={init.cards?.[0] ? (faces[init.cards[0]] ?? null) : null}
								faceDown={!table.round.shown.includes(seat.id)}
								pick={{ zone: init.id }}
							/>
						{:else}
							<span class="slot slot--empty">Initiative</span>
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
					{:else if selectedPick && durable && runs}
						<button
							type="button"
							class="slot slot--drop"
							onclick={() => drop(durable.id)}
							aria-label={`Give ${seat.name} an inspiration card`}>Inspiration</button
						>
					{/if}
				</div>

				{#if declaredHere?.position === 'minor' && facedown.count > 0}
					<Card
						face={facedown.cards?.[0] ? (faces[facedown.cards[0]] ?? null) : null}
						faceDown
						sideways
						declared={`${declaredHere.label} · ${addsWords(readiedAdds(declaredHere.position))}`}
						pick={{ zone: facedown.id }}
						onSelect={() =>
							canAct && (seat.id === mySeatId || runs)
								? onCommand({ type: 'use-readied', holder: seat.id })
								: null}
					/>
				{/if}
			</section>
		{/each}

		{#each table.opponents as enemy (enemy.id)}
			{@const init = zone(`opponent:${enemy.id}:initiative`)}
			<section class="combatant combatant--enemy">
				<h3>
					{enemy.name}
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
						<div class="combatant__init">
							<Card
								face={init.cards?.[0] ? (faces[init.cards[0]] ?? null) : null}
								faceDown={!table.round.shown.includes(enemy.id)}
								pick={{ zone: init.id }}
							/>
							<!-- The GM's, for when a player attacks this group: "flip your
							     Initiative card face up" holds for enemies too, and Session 14
							     had no way to (phase 33). -->
							{#if runs && !table.round.shown.includes(enemy.id)}
								<button
									type="button"
									class="tag-btn"
									disabled={busy}
									onclick={() => onCommand({ type: 'show-initiative', holder: enemy.id })}
									>Turn over<span class="sr-only"> {enemy.name}'s initiative</span></button
								>
							{/if}
						</div>
					{:else}
						<span class="slot slot--empty">Initiative</span>
					{/if}
					{#if table.facedown[`opponent:${enemy.id}:facedown`] && zone(`opponent:${enemy.id}:facedown`).count > 0}
						{@const readied = zone(`opponent:${enemy.id}:facedown`)}
						<Card
							face={readied.cards?.[0] ? (faces[readied.cards[0]] ?? null) : null}
							faceDown
							sideways
							declared={`${table.facedown[readied.id].label} · ${addsWords(readiedAdds(table.facedown[readied.id].position))}`}
							pick={{ zone: readied.id }}
							onSelect={() => (runs ? onCommand({ type: 'use-readied', holder: enemy.id }) : null)}
						/>
					{/if}
				</div>
				<!-- Below the cards, like an adventurer's: the turn first, the bookkeeping
				     after it. Above them, a folded group's controls pushed its initiative
				     slot out of line with every other combatant's. -->
				<Creatures group={enemy} {table} isGm={runs} {canAct} {busy} {onCommand} />
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
						placeholder="Zombie"
						autocomplete="off"
					/>
					<label>
						How many
						<input
							type="number"
							min="1"
							max="52"
							class="ct-field ct-field--number"
							bind:value={newEnemyCount}
						/>
					</label>
					<!-- Once for the type: every creature in the group starts with these.
					     Left blank, the group's HD is simply not tracked. -->
					<label>
						Health
						<input
							type="number"
							min="0"
							max="99"
							class="ct-field ct-field--number"
							bind:value={newEnemyHealth}
						/>
					</label>
					<label>
						Defense
						<input
							type="number"
							min="0"
							max="99"
							class="ct-field ct-field--number"
							bind:value={newEnemyDefense}
						/>
					</label>
					<button type="submit" class="ct-btn" disabled={busy || newEnemy.trim() === ''}>Add</button
					>
				</form>
				<!-- The GM's call, table-wide: Chris was undecided whether players
				     should see enemy Health, so it is a switch, shown by default. -->
				<label class="health-switch">
					<input
						type="checkbox"
						checked={table.enemyHealth !== 'hidden'}
						disabled={busy}
						onchange={(e) => onCommand({ type: 'enemy-health', shown: e.currentTarget.checked })}
					/>
					Players see enemy Health
				</label>
			</section>
		{/if}
	</div>

	<!-- Only with the hand actually on the table. A seat's zones arrive with the
	     poll that admits it, and drawing a hand that is not there yet threw and
	     froze the page (25 November 2026). -->
	{#if mySeatId && zone(`seat:${mySeatId}:hand`)}
		<div class="ch__hand">
			<div>
				<!-- Says how it is ordered: a player in Session 14 wondered whether their
				     hand had been shuffled (phase 33). -->
				<p class="ct-zone-label">
					{nameOf(mySeatId)} — your hand · sorted by value
				</p>
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
			<YourMove
				{table}
				{seats}
				{faces}
				catalogue={challengePack.actions}
				{mySeatId}
				{runs}
				{busy}
				selected={selectedPick}
				bind:chosen={chosenAction}
				bind:custom={customAction}
				bind:extras
				bind:collecting
				{onCommand}
				onDone={() => {
					extras = [];
					collecting = false;
					selection.clear();
				}}
				onPick={(pick) => selection.select(pick)}
			/>
		</div>
	{/if}
</div>

{#if openPile}
	<PileViewer
		pile={zone(openPile)}
		{faces}
		selected={selectedPick}
		hint="Pick a card up to move it, or look closer."
		bind:zoomed
		onSelect={select}
		onClose={closePane}
	/>
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
	/*
	 * Pinned to the top while the table scrolls under it. On a phone the
	 * Challenge is some 2,700px tall, and the line that says whose turn it is
	 * — and the GM's button to move on — was off the screen most of the time.
	 */
	.guide {
		position: sticky;
		inset-block-start: 0;
		z-index: 2;
		background: var(--ct-table);
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
		margin: 0;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--ct-rule-strong);
		border-radius: 4px;
	}
	/* "Your move" sits under the hand, a long way down on a phone. */
	.guide__jump {
		display: none;
		color: var(--ct-mark);
		text-decoration: underline;
		min-block-size: 2.75rem;
		align-items: center;
	}
	@media (max-width: 48rem) {
		.guide__jump {
			display: inline-flex;
		}
	}
	.guide__ask {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		flex-basis: 100%;
		color: var(--ct-mark);
	}
	.guide__ask form {
		margin: 0;
	}
	.guide__text {
		font-family: 'IM Fell English', Georgia, serif;
	}
	.guide__rule {
		color: var(--ct-mark);
		font-size: var(--ct-step-label);
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
	.ch__fate-btn {
		align-self: center;
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
	.combatant__init {
		display: grid;
		gap: 0.25rem;
		justify-items: center;
	}
	.slot--drop {
		border-style: solid;
		border-color: var(--ct-rule-strong);
		color: var(--ct-mark);
	}
	/* An empty slot that is somebody else's to fill: the same shape, nothing to press. */
	.health-switch {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-block-size: 2.75rem;
		font-size: 0.9rem;
	}
	.health-switch input {
		inline-size: 1.1rem;
		block-size: 1.1rem;
	}
	.slot.slot--empty {
		display: grid;
		place-items: center;
		cursor: default;
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
	/* The one control that keeps its natural height, and says why above. */
	.tag-btn {
		min-block-size: auto;
	}
</style>
